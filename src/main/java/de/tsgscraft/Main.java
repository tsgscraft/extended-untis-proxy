package de.tsgscraft;

import de.tsgscraft.webserver.WebServer;

import java.io.File;

public class Main {

    private static File configFile;

    private static int port = 0;

    public static String BASE_URL = "https://rfgs-freiburg.webuntis.com/WebUntis/jsonrpc.do?school=rfgs-freiburg";

    public static void main(String[] args) throws Exception {
        try {
            configFile = new File("config.json");
            loadConfig();
        }catch (Exception e) {
            System.out.println("Failed to load config: " + e.getMessage());
            return;
        }
        WebServer.setupServer(port);
        WebServer.startWebServer();
    }

    private static void loadConfig() {
        if (!configFile.exists()) {
            System.out.println("Config file not found, creating default config");
            createDefaultConfig();
        }

        try {
            String configContent = java.nio.file.Files.readString(configFile.toPath());
            org.json.JSONObject configJson = new org.json.JSONObject(configContent);
            port = configJson.getInt("port");
        } catch (Exception e) {
            System.out.println("Failed to load config: " + e.getMessage());
        }
    }

    private static void createDefaultConfig() {
        org.json.JSONObject defaultConfig = new org.json.JSONObject();
        defaultConfig.put("port", 49301);

        try {
            java.nio.file.Files.writeString(configFile.toPath(), defaultConfig.toString(4));
            System.out.println("Default config created at " + configFile.getAbsolutePath());
        } catch (Exception e) {
            System.out.println("Failed to create default config: " + e.getMessage());
        }
    }
}