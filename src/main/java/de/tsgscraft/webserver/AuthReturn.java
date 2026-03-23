package de.tsgscraft.webserver;

import java.net.http.HttpClient;

public class AuthReturn {
    public HttpClient client;
    public String token;
    public String response;
    public AuthReturn(HttpClient client, String token, String response) {
        this.client = client;
        this.token = token;
        this.response = response;
    }

    @Override
    public String toString() {
        return "AuthReturn{" +
                "client=" + client +
                ", token='" + token + '\'' +
                ", response='" + response + '\'' +
                '}';
    }
}
