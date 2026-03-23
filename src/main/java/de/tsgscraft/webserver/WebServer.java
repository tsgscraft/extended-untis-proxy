package de.tsgscraft.webserver;

import de.tsgscraft.Main;
import jakarta.servlet.http.Cookie;
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
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class WebServer {

    private static List<Site> sites = new ArrayList<>();
    private static Server server;
    private static int port;

    public static void setupServer(int port) {
        WebServer.port = port;
        System.out.println("Setting up server on port " + port);

        sites.add(new Site("/", "/index.html", "text/html", true, true));
        sites.add(new Site("/styles.css", "/styles.css", "text/css", false, true));
        sites.add(new Site("/main.js", "/main.js", "application/javascript", false, true));

        sites.add(new Site("/logo.png", "/logo.png", "image/png", false, true));
        sites.add(new Site("/smv.svg", "/smv.svg", "image/svg+xml", false, true));
        sites.add(new Site("/GitHub.svg", "/GitHub.svg", "image/svg+xml", false, true));
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

            if (json.has("method") && json.getString("method").equals("authenticate")) {
                try {
                    AuthReturn authReturn = auth(json);
                    if (authReturn == null) {
                        resp.setContentType("application/json; charset=UTF-8");
                        resp.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                        resp.getOutputStream().write("{\"error\": \"Authentication failed\"}".getBytes());
                        return;
                    }
                    clients.put(authReturn.token, authReturn.client);

                    resp.addCookie(new Cookie("JSESSIONID", authReturn.token));
                    resp.setContentType("application/json; charset=UTF-8");
                    resp.setStatus(HttpServletResponse.SC_OK);
                    resp.getOutputStream().write(authReturn.response.getBytes());
                    return;
                } catch (InterruptedException e) {
                    throw new RuntimeException(e);
                }
            }

            String token = getCookieValue(req, "JSESSIONID");

            System.out.println("Received POST request with token: " + token);

            String response = "";
            try {
                response = WebServer.doPostRaw(json, token);
            } catch (InterruptedException ignored) {}

            resp.addCookie(new Cookie("JSESSIONID", token));
            resp.setContentType("application/json; charset=UTF-8");
            resp.setStatus(HttpServletResponse.SC_OK);
            resp.getOutputStream().write(response.getBytes());
        }
    }

    private static String getCookieValue(HttpServletRequest req, String name) {
        Cookie[] cookies = req.getCookies();
        if (cookies == null) return null;

        for (Cookie cookie : cookies) {
            if (cookie.getName().equals(name)) {
                return cookie.getValue();
            }
        }
        return null;
    }


    public static final Map<String, HttpClient> clients = new HashMap<>();

    public static String doPostRaw(JSONObject payload, String token) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(Main.BASE_URL))
                .header("Content-Type", "application/json; charset=UTF-8")
                .header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(payload.toString(), StandardCharsets.UTF_8))
                .build();

        HttpResponse<byte[]> response = clients.get(token).send(request, HttpResponse.BodyHandlers.ofByteArray());

        if (response.statusCode() == 200) {
            return new String(response.body(), StandardCharsets.UTF_8);
        }
        return "{\"error\": \"Request failed\"}";
    }

    public static AuthReturn auth(JSONObject payload) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(Main.BASE_URL))
                .header("Content-Type", "application/json; charset=UTF-8")
                .header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(payload.toString(), StandardCharsets.UTF_8))
                .build();

        CookieManager cookieManager = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
        HttpClient client = HttpClient.newBuilder()
                .cookieHandler(cookieManager)
                .build();

        HttpResponse<byte[]> response = client.send(request, HttpResponse.BodyHandlers.ofByteArray());

        String token = null;
        for (String cookie : response.headers().allValues("set-cookie")) {
            if (cookie.startsWith("JSESSIONID=")) {
                token = cookie.split(";")[0].split("=")[1];
                break;
            }
        }

        if (response.statusCode() == 200) {
            return new AuthReturn(client, token, new String(response.body(), StandardCharsets.UTF_8));
        }
        return null;
    }
}
