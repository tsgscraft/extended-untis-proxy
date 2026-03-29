package de.tsgscraft;

import de.tsgscraft.webserver.WebServer;
import org.json.JSONObject;

import java.io.File;
import java.io.IOException;
import java.net.http.HttpClient;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class Main {

    private static File configFile;

    private static int port = 0;

    public static String BASE_URL = "https://rfgs-freiburg.webuntis.com/WebUntis/jsonrpc.do?school=rfgs-freiburg";

    public static ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);

    public static void main(String[] args) throws Exception {
        try {
            configFile = new File("config.json");
            loadConfig();
        }catch (Exception e) {
            System.out.println("Failed to load config: " + e.getMessage());
            return;
        }

        scheduler.scheduleAtFixedRate(() -> {
            try {
                List<String> tokensToRemove = new java.util.ArrayList<>();
                for (Map.Entry<String, HttpClient> entry : WebServer.clients.entrySet()) {
                    String token = entry.getKey();
                    HttpClient client = entry.getValue();

                    JSONObject json = new JSONObject();
                    json.put("jsonrpc", "2.0");
                    json.put("id", "999");
                    json.put("method", "getStatusData");
                    json.put("params", new JSONObject());

                    JSONObject response = new JSONObject(WebServer.doPostRaw(json, token));
                    if (response.has("error")) {
                        if (response.getJSONObject("error").getInt("code") == -8520) {
                            System.out.println("Client not authenticated anymore, removing token: " + token);
                            tokensToRemove.add(token);
                        }
                    }
                }
                for (String token : tokensToRemove) {
                    WebServer.clients.remove(token);
                }
            } catch (Exception e) {
                System.out.println("Scheduler error: " + e.getMessage());
                e.printStackTrace();
            }
        }, 0, 1, TimeUnit.MINUTES);

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