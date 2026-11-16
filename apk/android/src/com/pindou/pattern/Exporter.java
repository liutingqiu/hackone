package com.pindou.pattern;

import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Rect;
import android.graphics.pdf.PdfDocument;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * 导出落地：Android 10+ 走 MediaStore（相册 / 下载目录），更老的系统退到应用外部目录，
 * 统一用 FileProvider（本工程的 ShareProvider）分享。
 */
class Exporter {

    private final Context ctx;
    private final MainActivity host;
    private final Map<String, Job> jobs = new HashMap<>();
    private final AtomicInteger seq = new AtomicInteger(1);

    private static class Job {
        String name;
        String mime;
        OutputStream out;
        Uri uri;
        File file;
        PdfDocument pdf;
        int pages;
    }

    Exporter(MainActivity a) {
        host = a;
        ctx = a.getApplicationContext();
    }

    /* ---------------- 普通文件（png / zip / txt） ---------------- */

    synchronized String saveStart(String name, String mime) {
        try {
            Job j = openJob(safeName(name, null), mime);
            if (j == null) return "ERR:无法创建文件";
            String id = "j" + seq.getAndIncrement();
            jobs.put(id, j);
            return id;
        } catch (Exception e) {
            return "ERR:" + e.getMessage();
        }
    }

    synchronized boolean saveChunk(String id, String b64) {
        Job j = jobs.get(id);
        if (j == null || j.out == null) return false;
        try {
            byte[] data = Base64.decode(b64, Base64.DEFAULT);
            j.out.write(data);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    synchronized void saveEnd(String id, boolean share) {
        Job j = jobs.remove(id);
        if (j == null) return;
        try {
            j.out.flush();
            j.out.close();
            afterSave(j, share);
        } catch (Exception ignored) {
        }
    }

    synchronized void saveAbort(String id) {
        Job j = jobs.remove(id);
        if (j == null) return;
        try {
            if (j.out != null) j.out.close();
        } catch (Exception ignored) {
        }
        try {
            if (j.uri != null) ctx.getContentResolver().delete(j.uri, null, null);
            if (j.file != null) j.file.delete();
        } catch (Exception ignored) {
        }
    }

    /* ---------------- A4 PDF ---------------- */

    synchronized String pdfStart(String name) {
        try {
            Job j = new Job();
            j.mime = "application/pdf";
            j.name = safeName(name, ".pdf");
            j.pdf = new PdfDocument();
            String id = "p" + seq.getAndIncrement();
            jobs.put(id, j);
            return id;
        } catch (Exception e) {
            return "ERR:" + e.getMessage();
        }
    }

    synchronized boolean pdfPage(String id, String b64) {
        Job j = jobs.get(id);
        if (j == null || j.pdf == null) return false;
        Bitmap bm = null;
        try {
            byte[] bytes = Base64.decode(b64, Base64.DEFAULT);
            bm = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            if (bm == null) return false;
            PdfDocument.PageInfo info = new PdfDocument.PageInfo.Builder(595, 842, ++j.pages).create();
            PdfDocument.Page page = j.pdf.startPage(info);
            Canvas c = page.getCanvas();
            Paint p = new Paint(Paint.FILTER_BITMAP_FLAG | Paint.ANTI_ALIAS_FLAG);
            c.drawBitmap(bm, null, new Rect(0, 0, 595, 842), p);
            j.pdf.finishPage(page);
            return true;
        } catch (Throwable t) {
            return false;
        } finally {
            if (bm != null) bm.recycle();
        }
    }

    synchronized void pdfEnd(String id, boolean share) {
        Job j = jobs.remove(id);
        if (j == null || j.pdf == null) return;
        try {
            if (j.pages == 0) {
                j.pdf.close();
                return;
            }
            Job out = openJob(j.name, j.mime);
            if (out == null) {
                j.pdf.close();
                return;
            }
            j.pdf.writeTo(out.out);
            j.pdf.close();
            out.out.flush();
            out.out.close();
            afterSave(out, share);
        } catch (Exception ignored) {
        }
    }

    synchronized void pdfAbort(String id) {
        Job j = jobs.remove(id);
        if (j == null) return;
        try {
            if (j.pdf != null) j.pdf.close();
        } catch (Exception ignored) {
        }
    }

    /* ---------------- 内部 ---------------- */

    private Job openJob(String name, String mime) throws Exception {
        Job j = new Job();
        j.name = name;
        j.mime = mime == null ? "application/octet-stream" : mime;
        boolean image = j.mime.startsWith("image/");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentValues cv = new ContentValues();
            cv.put(MediaStore.MediaColumns.DISPLAY_NAME, j.name);
            cv.put(MediaStore.MediaColumns.MIME_TYPE, j.mime);
            Uri collection;
            if (image) {
                collection = MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
                cv.put(MediaStore.MediaColumns.RELATIVE_PATH,
                        Environment.DIRECTORY_PICTURES + "/拼豆图纸");
            } else {
                collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI;
                cv.put(MediaStore.MediaColumns.RELATIVE_PATH,
                        Environment.DIRECTORY_DOWNLOADS + "/拼豆图纸");
            }
            j.uri = ctx.getContentResolver().insert(collection, cv);
            if (j.uri == null) return null;
            j.out = ctx.getContentResolver().openOutputStream(j.uri);
            if (j.out == null) {
                ctx.getContentResolver().delete(j.uri, null, null);
                return null;
            }
        } else {
            File base = ctx.getExternalFilesDir(image
                    ? Environment.DIRECTORY_PICTURES : Environment.DIRECTORY_DOWNLOADS);
            File dir = new File(base, "拼豆图纸");
            if (!dir.exists() && !dir.mkdirs()) return null;
            j.file = uniqueFile(dir, j.name);
            j.out = new BufferedOutputStream(new FileOutputStream(j.file));
        }
        return j;
    }

    private File uniqueFile(File dir, String name) {
        File f = new File(dir, name);
        if (!f.exists()) return f;
        String base = name;
        String ext = "";
        int dot = name.lastIndexOf('.');
        if (dot > 0) {
            base = name.substring(0, dot);
            ext = name.substring(dot);
        }
        for (int i = 1; i < 1000; i++) {
            f = new File(dir, base + "_" + i + ext);
            if (!f.exists()) return f;
        }
        return f;
    }

    private void afterSave(Job j, boolean share) {
        if (j.file != null) {
            MediaScannerConnection.scanFile(ctx,
                    new String[]{j.file.getAbsolutePath()},
                    new String[]{j.mime}, null);
        }
        String where = j.uri != null
                ? (j.mime.startsWith("image/") ? "相册/Pictures/拼豆图纸" : "下载/Download/拼豆图纸")
                : j.file.getParent();
        if (share) {
            try {
                Uri u = j.uri;
                if (u == null) {
                    File root = ctx.getExternalFilesDir(null);
                    String rel = root.toURI().relativize(j.file.toURI()).getPath();
                    u = Uri.parse("content://" + ctx.getPackageName() + ".files/"
                            + Uri.encode(rel, "/"));
                }
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType(j.mime);
                send.putExtra(Intent.EXTRA_STREAM, u);
                send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                Intent chooser = Intent.createChooser(send, "分享图纸");
                chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(chooser);
            } catch (Exception ignored) {
            }
        }
        if (host != null) {
            host.showToast(share ? "已保存到 " + where + "，可分享" : "已保存到 " + where);
        }
    }

    private static String safeName(String name, String ext) {
        String n = name == null ? "拼豆图纸" : name.trim();
        n = n.replaceAll("[\\\\/:*?\"<>|\\r\\n]", "_");
        if (ext != null && !n.toLowerCase().endsWith(ext)) n = n + ext;
        if (n.length() > 120) n = n.substring(0, 120);
        return n.isEmpty() ? "拼豆图纸" : n;
    }
}