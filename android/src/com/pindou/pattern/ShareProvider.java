package com.pindou.pattern;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;

/**
 * 旧系统（Android 9 及以下）没有 MediaStore 分区存储，文件落在应用外部目录，
 * 这里把它包装成 content:// 供系统分享使用。
 */
public class ShareProvider extends ContentProvider {

    private File root;

    @Override
    public boolean onCreate() {
        root = getContext().getExternalFilesDir(null);
        return root != null;
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        File f = resolve(uri);
        if (!f.exists()) throw new FileNotFoundException(uri.toString());
        return ParcelFileDescriptor.open(f, ParcelFileDescriptor.MODE_READ_ONLY);
    }

    private File resolve(Uri uri) {
        String p = uri.getPath();
        if (p == null || root == null) throw new IllegalArgumentException("bad uri");
        try {
            File f = new File(root, p);
            String canonRoot = root.getCanonicalPath();
            String canon = f.getCanonicalPath();
            if (!canon.equals(canonRoot) && !canon.startsWith(canonRoot + File.separator)) {
                throw new IllegalArgumentException("outside root");
            }
            return f;
        } catch (IOException e) {
            throw new IllegalArgumentException("bad path");
        }
    }

    @Override
    public String getType(Uri uri) {
        String p = uri.getPath() == null ? "" : uri.getPath().toLowerCase();
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".pdf")) return "application/pdf";
        if (p.endsWith(".zip")) return "application/zip";
        if (p.endsWith(".txt")) return "text/plain";
        return "application/octet-stream";
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
        return null;
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        throw new UnsupportedOperationException();
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        return 0;
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
        return 0;
    }
}