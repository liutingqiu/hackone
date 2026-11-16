package com.pindou.pattern;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

/** 单 WebView 外壳：本地 127.0.0.1 服务 + 页面资源 + 原生导出桥。 */
public class MainActivity extends Activity {

    private static final int REQ_FILE = 1001;
    private WebView web;
    private AssetServer server;
    private ValueCallback<Uri[]> fileCallback;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        try {
            setup();
        } catch (Throwable t) {
            // 兜底：启动失败时把异常显示出来，方便截图反馈，不再直接闪退
            showCrash(t);
        }
    }

    private void setup() {
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        // API 1 就有的窗口标志：进页面时就不显示状态栏，避免闪一下白条
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);

        web = new WebView(this);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#eef1f5"));
        root.addView(web, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);
        root.post(new Runnable() {
            @Override
            public void run() {
                applyImmersive();
            }
        });

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setUseWideViewPort(false);
        s.setLoadWithOverviewMode(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setTextZoom(100);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            s.setSafeBrowsingEnabled(false);
        }

        web.setBackgroundColor(Color.parseColor("#eef1f5"));
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                return handleUrl(req.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, String url) {
                return handleUrl(Uri.parse(url));
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (fileCallback != null) {
                    fileCallback.onReceiveValue(null);
                }
                fileCallback = cb;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType(acceptMime(params));
                if (params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) {
                    i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                }
                try {
                    startActivityForResult(Intent.createChooser(i, "选择文件"), REQ_FILE);
                } catch (Exception e) {
                    fileCallback = null;
                    cb.onReceiveValue(null);
                }
                return true;
            }

            @Override
            public void onPermissionRequest(PermissionRequest request) {
                request.deny();   // 页面不使用摄像头/麦克风
            }
        });
        web.addJavascriptInterface(new NativeBridge(this), "NativeSave");

        server = new AssetServer(this);
        try {
            server.start();
            web.loadUrl(server.url("/index.html"));
        } catch (Exception e) {
            Toast.makeText(this, "本地资源服务启动失败：" + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private String acceptMime(WebChromeClient.FileChooserParams params) {
        String[] accept = params.getAcceptTypes();
        boolean image = false, other = false;
        if (accept != null) {
            for (String a : accept) {
                if (a == null) continue;
                String v = a.toLowerCase();
                if (v.contains("image")) image = true;
                else if (v.length() > 0) other = true;
            }
        }
        // 既支持图片又支持图纸文件时用 */*，打开系统的“文件管理”而不是相册
        return (image && !other) ? "image/*" : "*/*";
    }

    private boolean handleUrl(Uri u) {
        if (u == null) return false;
        String scheme = u.getScheme() == null ? "" : u.getScheme().toLowerCase();
        String host = u.getHost() == null ? "" : u.getHost();
        if (("http".equals(scheme) || "https".equals(scheme))
                && !("127.0.0.1".equals(host) || "localhost".equals(host))) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, u));
            } catch (Exception ignored) {
            }
            return true;
        }
        if ("blob".equals(scheme) || "data".equals(scheme)) {
            showToast("该导出方式在平板上不可用，请用 PNG/PDF 导出");
            return true;
        }
        return false;
    }

    /** 全屏沉浸：用所有系统版本都支持的 systemUiVisibility，隐藏状态栏与导航栏。 */
    private void applyImmersive() {
        try {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        } catch (Throwable ignored) {
        }
    }

    /** 启动异常兜底页面：把堆栈直接显示出来，方便截图反馈。 */
    private void showCrash(Throwable t) {
        StringBuilder sb = new StringBuilder();
        sb.append("启动失败\n\n").append(t.toString()).append("\n\n");
        StackTraceElement[] st = t.getStackTrace();
        for (int i = 0; i < Math.min(st.length, 25); i++) {
            sb.append(st[i].toString()).append('\n');
        }
        Throwable cause = t.getCause();
        if (cause != null) {
            sb.append("\nCaused by: ").append(cause.toString()).append('\n');
            StackTraceElement[] cs = cause.getStackTrace();
            for (int i = 0; i < Math.min(cs.length, 15); i++) {
                sb.append(cs[i].toString()).append('\n');
            }
        }
        TextView tv = new TextView(this);
        tv.setText(sb.toString());
        tv.setTextSize(12f);
        tv.setTextColor(Color.parseColor("#1c1f26"));
        tv.setBackgroundColor(Color.parseColor("#ffffff"));
        tv.setPadding(24, 24, 24, 24);
        tv.setTextIsSelectable(true);
        ScrollView sv = new ScrollView(this);
        sv.addView(tv);
        setContentView(sv);
        try {
            java.io.File f = new java.io.File(getExternalFilesDir(null), "crash.log");
            java.io.FileOutputStream out = new java.io.FileOutputStream(f);
            out.write(sb.toString().getBytes("UTF-8"));
            out.close();
        } catch (Throwable ignored) {
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) applyImmersive();
    }

    @Override
    public void onConfigurationChanged(android.content.res.Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        applyImmersive();
    }

    void openExternal(final String url) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "没有可打开该链接的应用", Toast.LENGTH_SHORT).show();
                }
            }
        });
    }

    void copyToClipboard(final String text) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                    if (cm != null) {
                        cm.setPrimaryClip(ClipData.newPlainText("拼豆清单", text));
                        Toast.makeText(MainActivity.this, "已复制到剪贴板", Toast.LENGTH_SHORT).show();
                    }
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "复制失败", Toast.LENGTH_SHORT).show();
                }
            }
        });
    }

    void showToast(final String msg) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                Toast.makeText(MainActivity.this, msg, Toast.LENGTH_SHORT).show();
            }
        });
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req == REQ_FILE) {
            Uri[] out = null;
            if (res == RESULT_OK && data != null) {
                if (data.getData() != null) {
                    out = new Uri[]{data.getData()};
                } else if (data.getClipData() != null) {
                    ClipData cd = data.getClipData();
                    out = new Uri[cd.getItemCount()];
                    for (int i = 0; i < cd.getItemCount(); i++) {
                        out[i] = cd.getItemAt(i).getUri();
                    }
                }
            }
            if (fileCallback != null) {
                fileCallback.onReceiveValue(out);
                fileCallback = null;
            }
            return;
        }
        super.onActivityResult(req, res, data);
    }

    @Override
    public void onBackPressed() {
        if (web == null) {
            super.onBackPressed();
            return;
        }
        web.evaluateJavascript("(window.__onBack?window.__onBack():'exit')", new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String value) {
                if (value == null || !value.contains("closed")) {
                    finish();
                }
            }
        });
    }

    @Override
    protected void onDestroy() {
        if (server != null) {
            server.stop();
        }
        if (web != null) {
            web.loadUrl("about:blank");
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}