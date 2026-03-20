package de.tsgscraft.webserver;

import de.tsgscraft.Main;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.eclipse.jetty.ee11.servlet.ServletContextHandler;
import org.eclipse.jetty.ee11.servlet.ServletHolder;
import org.eclipse.jetty.server.Server;
import org.json.JSONObject;

import java.io.IOException;
import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class WebServer {

    private static List<Site> sites = new ArrayList<>();
    private static Server server;
    private static int port;

    private static final CookieManager cookieManager = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
    private static final HttpClient client = HttpClient.newBuilder()
            .cookieHandler(cookieManager)
            .build();

    public static void setupServer(int port) {
        WebServer.port = port;
        System.out.println("Setting up server on port " + port);

        sites.add(new Site("/", "/index.html", "text/html", true, true));
        sites.add(new Site("/styles.css", "/styles.css", "text/css", false, true));
        sites.add(new Site("/main.js", "/main.js", "application/javascript", false, true));

        sites.add(new Site("/logo.png", "/logo.png", "image/png", false, true));
        sites.add(new Site("/smv.svg", "/smv.svg", "image/svg+xml", false, true));
    }

    public static void startWebServer() throws Exception {
        server = new Server(port);
        ServletContextHandler context = new ServletContextHandler(ServletContextHandler.SESSIONS);

        for (Site site : sites) {
            // Skip default basic servlet for the special /stream endpoint
            if (!site.isAdvanced()) {
                context.addServlet(new ServletHolder(new BasicSiteServlet(site)), site.getUrl());
                context.addServlet(new ServletHolder(new BasicSiteServlet(site)), site.getUrl() + "/");
                System.out.println("Loaded basic site: " + site.getUrl());
            } else {
                System.out.println("Loaded advanced site: " + site.getUrl());
            }

            switch (site.getUrl()) {
                case "/":
                    context.addServlet(new ServletHolder(new AdvancedSiteServlet(site)), site.getUrl());
                    context.addServlet(new ServletHolder(new AdvancedSiteServlet(site)), site.getUrl() + "/");
                    break;
            }
        }

        server.setHandler(context);
        try {
            server.start();
            server.join();
        } catch (IOException e) {
            System.err.println("Port " + port + " is already in use. Please free the port and try again.");
            System.exit(1);
        }
        System.out.println("Web server started on http://localhost:" + port);
    }

    public static void stopWebServer() throws Exception {
        if (server != null) {
            server.stop();
            server = null;
        }
    }

    public static List<String> getSiteUrls() {
        List<String> urls = new ArrayList<>();
        for (Site site : sites) {
            urls.add(site.getUrl());
        }
        return urls;
    }

    // --- Servlet-Klassen ---

    public static class BasicSiteServlet extends HttpServlet {
        private final Site site;

        public BasicSiteServlet(Site site) {
            this.site = site;
        }

        @Override
        protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
            if (site.getContent() == null) {
                resp.setStatus(HttpServletResponse.SC_NO_CONTENT);
                return;
            }
            req.setCharacterEncoding("UTF-8");
            resp.setCharacterEncoding("UTF-8");

            resp.setContentType(site.getType());
            resp.setStatus(HttpServletResponse.SC_OK);
            resp.getOutputStream().write(site.getContent());
        }
    }

    public static class AdvancedSiteServlet extends HttpServlet {
        private final Site site;

        public AdvancedSiteServlet(Site site) {
            this.site = site;
        }

        @Override
        protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
            if (site.getContent() == null) {
                resp.setStatus(HttpServletResponse.SC_NO_CONTENT);
                return;
            }
            req.setCharacterEncoding("UTF-8");
            resp.setCharacterEncoding("UTF-8");

            resp.setContentType(site.getType());
            resp.setStatus(HttpServletResponse.SC_OK);
            resp.getOutputStream().write(site.getContent());
        }

        @Override
        protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
            if (site.getContent() == null) {
                resp.setStatus(HttpServletResponse.SC_NOT_FOUND);
                return;
            }
            req.setCharacterEncoding("UTF-8");
            resp.setCharacterEncoding("UTF-8");

            String body = req.getReader().lines().reduce("", (acc, line) -> acc + line);
            JSONObject json = new JSONObject(body);
            System.out.println("Received POST request with data: " + json.toString());

            String response = "";
            try {
                response = WebServer.doPostRaw(json);
            } catch (InterruptedException ignored) {}



            resp.setContentType("application/json; charset=UTF-8");
            resp.setStatus(HttpServletResponse.SC_OK);
            resp.getOutputStream().write(response.getBytes());
        }
    }

    public static JSONObject doPost(JSONObject payload) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(Main.BASE_URL))
                .header("Content-Type", "application/json; charset=UTF-8")
                .header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(payload.toString(), StandardCharsets.UTF_8)) // explicit charset
                .build();

        HttpResponse<byte[]> response = client.send(request, HttpResponse.BodyHandlers.ofByteArray());

        if (response.statusCode() == 200) {
            String contentType = response.headers().firstValue("content-type").orElse("");
            System.out.println("Content-Type: " + contentType);

            String rawBody = new String(response.body(), StandardCharsets.ISO_8859_1);
            System.out.println("Raw response: " + rawBody);

            JSONObject responseObject = new JSONObject(rawBody);
            return responseObject;
        }
        return null;
    }

    public static String doPostRaw(JSONObject payload) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(Main.BASE_URL))
                .header("Content-Type", "application/json; charset=UTF-8")
                .header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(payload.toString(), StandardCharsets.UTF_8))
                .build();

        HttpResponse<byte[]> response = client.send(request, HttpResponse.BodyHandlers.ofByteArray());

        if (response.statusCode() == 200) {
            return new String(response.body(), StandardCharsets.UTF_8);
        }
        return "{\"error\": \"Request failed\"}";
    }
}
