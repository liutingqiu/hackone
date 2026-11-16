package com.pindou.pattern;

import android.webkit.JavascriptInterface;

/** 注入给页面的原生能力（页面上以 window.NativeSave 访问）。 */
public class NativeBridge {

    private final MainActivity act;
    private final Exporter exporter;

    NativeBridge(MainActivity a) {
        act = a;
        exporter = new Exporter(a);
    }

    @JavascriptInterface
    public boolean isNative() {
        return true;
    }

    @JavascriptInterface
    public String saveStart(String name, String mime) {
        return exporter.saveStart(name, mime);
    }

    @JavascriptInterface
    public boolean saveChunk(String id, String base64) {
        return exporter.saveChunk(id, base64);
    }

    @JavascriptInterface
    public void saveEnd(String id, boolean share) {
        exporter.saveEnd(id, share);
    }

    @JavascriptInterface
    public void saveAbort(String id) {
        exporter.saveAbort(id);
    }

    @JavascriptInterface
    public String pdfStart(String name) {
        return exporter.pdfStart(name);
    }

    @JavascriptInterface
    public boolean pdfPage(String id, String base64) {
        return exporter.pdfPage(id, base64);
    }

    @JavascriptInterface
    public void pdfEnd(String id, boolean share) {
        exporter.pdfEnd(id, share);
    }

    @JavascriptInterface
    public void pdfAbort(String id) {
        exporter.pdfAbort(id);
    }

    @JavascriptInterface
    public void openUrl(String url) {
        act.openExternal(url);
    }

    @JavascriptInterface
    public void copyText(String text) {
        act.copyToClipboard(text);
    }

    @JavascriptInterface
    public void toast(String msg) {
        act.showToast(msg);
    }
}