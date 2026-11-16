package com.pindou.pattern;

import android.content.Context;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URLDecoder;
import java.util.Locale;

/**
 * 只监听 127.0.0.1 的极简静态服务。
 * 用 http 源而不是 file:// ，让 localStorage / 剪贴板 / blob 都有正常的安全上下文。
 */
public class AssetServer {

    private final Context ctx;
    private ServerSocket ss;
    private Thread thread;
    private volatile boolean running;
    private int port;

    AssetServer(Context c) {
        ctx = c.getApplicationContext();
    }

    void start() throws IOException {
        ss = new ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"));
        port = ss.getLocalPort();
        running = true;
        thread = new Thread(new Runnable() {
            @Override
            public void run() {
                loop();
            }
        }, "asset-server");
        thread.setDaemon(true);
        thread.start();
    }

    String url(String path) {
        return "http://127.0.0.1:" + port + path;
    }

    void stop() {
        running = false;
        try {
            if (ss != null) ss.close();
        } catch (IOException ignored) {
        }
    }

    private void loop() {
        while (running) {
            try {
                final Socket s = ss.accept();
                Thread t = new Thread(new Runnable() {
                    @Override
                    public void run() {
                        handle(s);
                    }
                }, "asset-conn");
                t.setDaemon(true);
                t.start();
            } catch (IOException e) {
                if (!running) return;
                try {
                    Thread.sleep(60);
                } catch (InterruptedException ignored) {
                }
            }
        }
    }

    private void handle(Socket s) {
        try {
            s.setSoTimeout(5000);
            InputStream in = s.getInputStream();
            ByteArrayOutputStream head = new ByteArrayOutputStream(1024);
            int c;
            int match = 0;
            final byte[] end = new byte[]{'\r', '\n', '\r', '\n'};
            while ((c = in.read()) != -1) {
                head.write(c);
                if (c == end[match]) {
                    match++;
                    if (match == end.length) break;
                } else {
                    match = (c == end[0]) ? 1 : 0;
                }
                if (head.size() > 16384) break;
            }
            String text = new String(head.toByteArray(), "ISO-8859-1");
            String first = text.split("\r\n")[0];
            String[] parts = first.split(" ");
            if (parts.length < 2) {
                respond(s, 400, "text/plain", "Bad Request".getBytes("UTF-8"));
                return;
            }
            String path = parts[1];
            int q = path.indexOf('?');
            if (q >= 0) path = path.substring(0, q);
            path = URLDecoder.decode(path, "UTF-8");
            if (path.isEmpty() || "/".equals(path)) path = "/index.html";
            if (path.contains("..")) {
                respond(s, 400, "text/plain", "Bad Request".getBytes("UTF-8"));
                return;
            }
            String asset = "www" + path;
            InputStream is;
            try {
                is = ctx.getAssets().open(asset);
            } catch (IOException e) {
                respond(s, 404, "text/plain", "Not Found".getBytes("UTF-8"));
                return;
            }
            ByteArrayOutputStream bos = new ByteArrayOutputStream(200000);
            byte[] buf = new byte[32768];
            int n;
            while ((n = is.read(buf)) > 0) bos.write(buf, 0, n);
            is.close();
            respond(s, 200, mimeOf(path), bos.toByteArray());
        } catch (Exception ignored) {
        } finally {
            try {
                s.close();
            } catch (IOException ignored) {
            }
        }
    }

    private void respond(Socket s, int code, String mime, byte[] data) throws IOException {
        String status = code == 200 ? "OK" : (code == 404 ? "Not Found" : "Bad Request");
        String head = "HTTP/1.1 " + code + " " + status + "\r\n"
                + "Content-Type: " + mime + "\r\n"
                + "Content-Length: " + data.length + "\r\n"
                + "Cache-Control: no-store\r\n"
                + "Connection: close\r\n\r\n";
        OutputStream os = s.getOutputStream();
        os.write(head.getBytes("ISO-8859-1"));
        os.write(data);
        os.flush();
    }

    private String mimeOf(String path) {
        String p = path.toLowerCase(Locale.US);
        if (p.endsWith(".html") || p.endsWith(".htm")) return "text/html; charset=utf-8";
        if (p.endsWith(".js")) return "application/javascript; charset=utf-8";
        if (p.endsWith(".css")) return "text/css; charset=utf-8";
        if (p.endsWith(".json")) return "application/json; charset=utf-8";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".webp")) return "image/webp";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".woff2")) return "font/woff2";
        return "application/octet-stream";
    }
}