package com.tool.itemmanage;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.DocumentsContract;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * 备份文件的系统级读写通道，基于 SAF（存储访问框架）：
 * - save：调起「另存为」界面，由用户选择目录与文件名；支持传入目录级 URI 预置初始位置；
 * - overwrite：直接覆盖上次保存过的文件；
 * - pickBackup：调起「打开文件」界面，并读出文件内容。
 */
@CapacitorPlugin(name = "SaveAs")
public class SaveAsPlugin extends Plugin {

    // 读取备份时的体积上限，避免异常文件把内存撑爆。
    private static final long MAX_READ_BYTES = 8L * 1024 * 1024;

    @PluginMethod
    public void save(PluginCall call) {
        String filename = call.getString("filename");
        String data = call.getString("data");
        String mimeType = call.getString("mimeType", "application/json");

        if (filename == null || filename.trim().isEmpty() || data == null) {
            call.reject("缺少 filename 或 data 参数。");
            return;
        }

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mimeType);
        intent.putExtra(Intent.EXTRA_TITLE, filename);
        // 允许把返回的 URI 持久化，重启应用后仍可覆盖同一个文件。
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        applyInitialUri(intent, call.getString("initialUri"));

        startActivityForResult(call, intent, "saveResult");
    }

    @PluginMethod
    public void overwrite(PluginCall call) {
        String uriString = call.getString("uri");
        String data = call.getString("data");
        if (uriString == null || data == null) {
            call.reject("缺少 uri 或 data 参数。");
            return;
        }

        Uri uri = Uri.parse(uriString);
        try (OutputStream stream = getContext().getContentResolver().openOutputStream(uri, "wt")) {
            if (stream == null) {
                call.reject("无法打开上次的备份文件。");
                return;
            }
            stream.write(data.getBytes(StandardCharsets.UTF_8));
            stream.flush();
            call.resolve(buildFileInfo(uri));
        } catch (Exception error) {
            call.reject("无法覆盖上次的备份文件：" + error.getLocalizedMessage());
        }
    }

    @PluginMethod
    public void pickBackup(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        applyInitialUri(intent, call.getString("initialUri"));

        startActivityForResult(call, intent, "pickResult");
    }

    @ActivityCallback
    private void saveResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        if (result.getResultCode() != Activity.RESULT_OK
                || result.getData() == null
                || result.getData().getData() == null) {
            resolveCanceled(call);
            return;
        }

        Uri uri = result.getData().getData();
        String data = call.getString("data");
        if (data == null) {
            call.reject("写入失败：缺少 data 参数。");
            return;
        }

        // 失败时只影响下次能否直接覆盖，不影响本次导出，因此不抛出。
        try {
            getContext().getContentResolver().takePersistableUriPermission(uri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        } catch (Exception ignored) {
            // 该 provider 不支持持久化权限时，下次导出会走「位置已失效」的提示。
        }

        try (OutputStream stream = getContext().getContentResolver().openOutputStream(uri)) {
            if (stream == null) {
                call.reject("写入失败：无法打开目标文件。");
                return;
            }
            stream.write(data.getBytes(StandardCharsets.UTF_8));
            stream.flush();
            call.resolve(buildFileInfo(uri));
        } catch (Exception error) {
            call.reject("写入失败：" + error.getLocalizedMessage());
        }
    }

    @ActivityCallback
    private void pickResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        if (result.getResultCode() != Activity.RESULT_OK
                || result.getData() == null
                || result.getData().getData() == null) {
            resolveCanceled(call);
            return;
        }

        Uri uri = result.getData().getData();
        try (InputStream stream = getContext().getContentResolver().openInputStream(uri)) {
            if (stream == null) {
                call.reject("无法读取所选文件。");
                return;
            }
            byte[] bytes = readAll(stream);
            if (bytes == null) {
                call.reject("备份文件超过 8 MB，无法导入。");
                return;
            }
            JSObject info = buildFileInfo(uri);
            info.put("data", new String(bytes, StandardCharsets.UTF_8));
            call.resolve(info);
        } catch (Exception error) {
            call.reject("读取文件失败：" + error.getLocalizedMessage());
        }
    }

    private byte[] readAll(InputStream stream) throws Exception {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        byte[] chunk = new byte[8192];
        long total = 0;
        int read;
        while ((read = stream.read(chunk)) != -1) {
            total += read;
            if (total > MAX_READ_BYTES) return null;
            buffer.write(chunk, 0, read);
        }
        return buffer.toByteArray();
    }

    private void resolveCanceled(PluginCall call) {
        JSObject canceled = new JSObject();
        canceled.put("canceled", true);
        call.resolve(canceled);
    }

    /**
     * 预置文件选择器的初始位置。只接受目录级 URI（如 ExternalStorageProvider 的
     * content://.../document/primary:Download）：文件级 URI 会被部分厂商的选择器忽略，
     * 反而造成困惑，因此导入不再传入初始位置，仅「另存为」用于定位上次保存目录。
     */
    private void applyInitialUri(Intent intent, String initialUri) {
        if (initialUri == null || initialUri.isEmpty()) return;
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        intent.putExtra(DocumentsContract.EXTRA_INITIAL_URI, Uri.parse(initialUri));
    }

    /** 返回文件名与便于展示的路径，例如「内部存储/Download/物品管家备份-2026-10-20.json」。 */
    private JSObject buildFileInfo(Uri uri) {
        JSObject info = new JSObject();
        info.put("canceled", false);
        info.put("uri", uri.toString());
        info.put("name", queryDisplayName(uri));
        info.put("path", buildDisplayPath(uri));
        return info;
    }

    private String queryDisplayName(Uri uri) {
        try (Cursor cursor = getContext().getContentResolver()
                .query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (index >= 0) return cursor.getString(index);
            }
        } catch (Exception ignored) {
            // 查询失败时退回 URI 末段。
        }
        String segment = uri.getLastPathSegment();
        return segment == null ? "" : segment;
    }

    private String buildDisplayPath(Uri uri) {
        try {
            String documentId = DocumentsContract.getDocumentId(uri);
            // DownloadsProvider 对普通文件可能直接返回 raw:/storage/emulated/0/Download/xxx.json。
            if (documentId.startsWith("raw:")) return normalizeStoragePath(documentId.substring(4));
            int colon = documentId.indexOf(':');
            if (colon >= 0) {
                // ExternalStorageProvider：primary:Download/物品管家备份.json
                String path = documentId.substring(colon + 1);
                return documentId.startsWith("primary:") ? normalizeStoragePath("/storage/emulated/0/" + path) : path;
            }
            // DownloadsProvider 返回的是数字 id，需要查 MediaStore 才能还原成可读路径。
            if (uri.getAuthority() != null && uri.getAuthority().contains("downloads")) {
                String realPath = queryDownloadPath(documentId);
                if (realPath != null && !realPath.isEmpty()) return normalizeStoragePath(realPath);
                return "内部存储/下载/" + queryDisplayName(uri);
            }
        } catch (Exception ignored) {
            // 非 DocumentsProvider 的 URI 走到这里。
        }
        return queryDisplayName(uri);
    }

    /** 把 /storage/emulated/0/xxx 或 /emulated/0/xxx 统一成「内部存储/xxx」。 */
    private String normalizeStoragePath(String path) {
        String marker = "/storage/emulated/0/";
        if (path.startsWith(marker)) return "内部存储/" + path.substring(marker.length());
        String legacy = "/emulated/0/";
        int index = path.indexOf(legacy);
        if (index >= 0) return "内部存储/" + path.substring(index + legacy.length());
        return path;
    }

    private String queryDownloadPath(String id) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return null;
        try (Cursor cursor = getContext().getContentResolver().query(
                MediaStore.Downloads.EXTERNAL_CONTENT_URI,
                new String[]{MediaStore.Downloads.DATA},
                "_id=?",
                new String[]{id},
                null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int index = cursor.getColumnIndex(MediaStore.Downloads.DATA);
                if (index >= 0) return cursor.getString(index);
            }
        } catch (Exception ignored) {
            // 查不到就退回文件名。
        }
        return null;
    }
}
