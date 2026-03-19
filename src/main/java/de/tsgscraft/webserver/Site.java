package de.tsgscraft.webserver;

import de.tsgscraft.Main;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.net.URL;

public class Site {
    private final String url;
    private final String path;
    private final String type;
    private final boolean advanced;

    private byte[] content;

    public Site(String url) {
        this.url = url;
        this.path = null;
        this.type = null;
        this.advanced = true;
    }

    public Site(String url, String path, String type) {
        this(url, path, type, false);
    }

    public Site(String url, String type, boolean advanced) {
        this(url, null, type, advanced, false);
    }

    public Site(String url, String path, String type, boolean advanced) {
        this(url, path, type, advanced, true);
    }

    public Site(String url, String path, String type, boolean advanced, boolean resource) {
        this.url = url;
        this.path = path;
        this.type = type;
        this.advanced = advanced;

        System.out.println("Creating site for URL: " + url + " with path: " + path + " and type: " + type);

        if (resource) {

            try {
                URL fileUrl = Main.class.getResource(path);
                assert fileUrl != null;
                InputStream fileIS = fileUrl.openStream();
                content = fileIS.readAllBytes();
            } catch (IOException e) {
                System.out.println("Failed to find site for: " + url + " with path: " + path);
            }
        }else {
            File file = new File(path);
            try {
                content = java.nio.file.Files.readAllBytes(file.toPath());
            } catch (IOException e) {
                System.out.println(file.getAbsolutePath() + " not found");
                System.out.println("Failed to find site for: " + url + " with path: " + path);
            }
        }
    }

    public void setContent(byte[] content) {
        this.content = content;
    }

    public void setContent(String content) {
        this.content = content.getBytes();
    }

    public byte[] getContent() {
        return content;
    }

    public String getPath() {
        return path;
    }

    public String getType() {
        return type;
    }

    public String getUrl() {
        return url;
    }

    public boolean isAdvanced() {
        return advanced;
    }

    public String getContentAsString() {
        return new String(content);
    }
}
