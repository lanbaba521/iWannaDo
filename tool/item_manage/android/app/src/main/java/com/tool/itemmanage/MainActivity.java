package com.tool.itemmanage;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 自定义插件，不是 npm 包，需要在 super.onCreate() 之前手动注册。
        registerPlugin(SaveAsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
