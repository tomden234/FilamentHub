package com.filamenthub.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSocketFactory;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import org.eclipse.paho.client.mqttv3.IMqttActionListener;
import org.eclipse.paho.client.mqttv3.IMqttDeliveryToken;
import org.eclipse.paho.client.mqttv3.IMqttToken;
import org.eclipse.paho.client.mqttv3.MqttAsyncClient;
import org.eclipse.paho.client.mqttv3.MqttCallbackExtended;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;

// Echte MQTT-Verbindung (TLS, Port 8883) direkt aus der App zur Bambu Cloud, ohne eigenen Server.
// Die Web-App bekommt alles als Ereignis "event": { id, type: connect | close | message | error, ... }.
@CapacitorPlugin(name = "FilamentMqtt")
public class FilamentMqttPlugin extends Plugin {

    private final Map<String, MqttAsyncClient> clients = new ConcurrentHashMap<>();

    /**
     * Nur für den LAN-Modus: Der Drucker im Heimnetz hat ein selbstsigniertes Zertifikat, das Android nicht kennt.
     * Die Web-App erlaubt diesen Modus nur für Adressen im Heimnetz oder Tailscale (nie für Server im Internet).
     */
    private static SSLSocketFactory trustAllFactory() throws Exception {
        TrustManager[] trustAll = new TrustManager[] {
            new X509TrustManager() {
                @Override
                public void checkClientTrusted(X509Certificate[] chain, String authType) {
                }

                @Override
                public void checkServerTrusted(X509Certificate[] chain, String authType) {
                }

                @Override
                public X509Certificate[] getAcceptedIssuers() {
                    return new X509Certificate[0];
                }
            }
        };
        SSLContext ctx = SSLContext.getInstance("TLS");
        ctx.init(null, trustAll, new SecureRandom());
        return ctx.getSocketFactory();
    }

    /** Host aus „ssl://192.168.1.5:8883“: privat (10/8, 172.16/12, 192.168/16) oder Tailscale (100.64/10)? */
    static boolean isLanHost(String url) {
        try {
            String rest = url.substring(url.indexOf("://") + 3);
            String host = rest.split("[:/]")[0];
            String[] p = host.split("\\.");
            if (p.length != 4) return false;
            int a = Integer.parseInt(p[0]), b = Integer.parseInt(p[1]);
            for (String x : p) { int n = Integer.parseInt(x); if (n < 0 || n > 255) return false; }
            return a == 10 || (a == 192 && b == 168) || (a == 172 && b >= 16 && b <= 31) || (a == 100 && b >= 64 && b <= 127);
        } catch (Exception e) {
            return false;
        }
    }

    private void emit(String id, String type, String topic, String payload, int code, String message) {
        JSObject o = new JSObject();
        o.put("id", id);
        o.put("type", type);
        if (topic != null) o.put("topic", topic);
        if (payload != null) o.put("payload", payload);
        if (code >= 0) o.put("code", code);
        if (message != null) o.put("message", message);
        notifyListeners("event", o);
    }

    /** Fehlertext mit der eigentlichen Ursache (Paho meldet sonst nur „Unable to connect to server") */
    private static String describe(Throwable e) {
        if (e == null) return "Verbindung fehlgeschlagen";
        String msg = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
        Throwable cause = e.getCause();
        if (cause != null && cause != e) {
            msg = msg + ": " + cause.getClass().getSimpleName() + (cause.getMessage() != null ? " " + cause.getMessage() : "");
        }
        return msg;
    }

    private void closeClient(String id) {
        MqttAsyncClient old = clients.remove(id);
        if (old == null) return;
        try {
            old.setCallback(null);
        } catch (Exception ignored) {
        }
        try {
            if (old.isConnected()) old.disconnectForcibly(300, 300);
        } catch (Exception ignored) {
        }
        try {
            old.close(true);
        } catch (Exception ignored) {
        }
    }

    @PluginMethod
    public void connect(final PluginCall call) {
        final String id = call.getString("id");
        final String url = call.getString("url");
        final String username = call.getString("username");
        final String password = call.getString("password");
        final String clientId = call.getString("clientId");
        final boolean insecure = Boolean.TRUE.equals(call.getBoolean("insecure"));
        if (id == null || url == null || clientId == null) {
            call.reject("id, url und clientId sind erforderlich");
            return;
        }
        // 1.229: Ohne Zertifikatsprüfung nur ins Heimnetz oder Tailscale (nie zu Servern im Internet)
        if (insecure && !isLanHost(url)) {
            call.reject("Unsichere Verbindung nur im Heimnetz oder über Tailscale erlaubt");
            return;
        }
        try {
            closeClient(id);
            final MqttAsyncClient client = new MqttAsyncClient(url, clientId, new MemoryPersistence());

            MqttConnectOptions options = new MqttConnectOptions();
            if (username != null) options.setUserName(username);
            if (password != null) options.setPassword(password.toCharArray());
            options.setCleanSession(true);
            options.setConnectionTimeout(8);
            options.setKeepAliveInterval(30);
            options.setAutomaticReconnect(true);
            options.setMaxReconnectDelay(60000);
            // TLS mit den Zertifikaten des Systems (Bambu Cloud hat ein öffentliches Zertifikat)
            if (url.startsWith("ssl://")) {
                options.setSocketFactory(insecure ? trustAllFactory() : SSLSocketFactory.getDefault());
                if (insecure) options.setHttpsHostnameVerificationEnabled(false);
            }

            client.setCallback(new MqttCallbackExtended() {
                @Override
                public void connectComplete(boolean reconnect, String serverURI) {
                    emit(id, "connect", null, null, -1, null);
                }

                @Override
                public void connectionLost(Throwable cause) {
                    emit(id, "close", null, null, -1, describe(cause));
                }

                @Override
                public void messageArrived(String topic, MqttMessage message) {
                    emit(id, "message", topic, new String(message.getPayload(), StandardCharsets.UTF_8), -1, null);
                }

                @Override
                public void deliveryComplete(IMqttDeliveryToken token) {
                }
            });

            clients.put(id, client);
            client.connect(options, null, new IMqttActionListener() {
                @Override
                public void onSuccess(IMqttToken asyncActionToken) {
                    // "connect" meldet connectComplete
                }

                @Override
                public void onFailure(IMqttToken asyncActionToken, Throwable exception) {
                    int code = exception instanceof MqttException ? ((MqttException) exception).getReasonCode() : -1;
                    emit(id, "error", null, null, code, describe(exception));
                    closeClient(id);
                }
            });
            call.resolve();
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    @PluginMethod
    public void subscribe(final PluginCall call) {
        final MqttAsyncClient client = clients.get(call.getString("id"));
        final String topic = call.getString("topic");
        if (client == null || topic == null) {
            call.reject("nicht verbunden");
            return;
        }
        try {
            client.subscribe(topic, call.getInt("qos", 0), null, new IMqttActionListener() {
                @Override
                public void onSuccess(IMqttToken asyncActionToken) {
                    call.resolve();
                }

                @Override
                public void onFailure(IMqttToken asyncActionToken, Throwable exception) {
                    call.reject(String.valueOf(exception != null ? exception.getMessage() : "subscribe fehlgeschlagen"));
                }
            });
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    @PluginMethod
    public void publish(final PluginCall call) {
        final MqttAsyncClient client = clients.get(call.getString("id"));
        final String topic = call.getString("topic");
        if (client == null || topic == null || !client.isConnected()) {
            call.reject("nicht verbunden");
            return;
        }
        try {
            String payload = call.getString("payload", "");
            client.publish(topic, payload.getBytes(StandardCharsets.UTF_8), call.getInt("qos", 0), false, null,
                    new IMqttActionListener() {
                        @Override
                        public void onSuccess(IMqttToken asyncActionToken) {
                            call.resolve();
                        }

                        @Override
                        public void onFailure(IMqttToken asyncActionToken, Throwable exception) {
                            call.reject(String.valueOf(exception != null ? exception.getMessage() : "publish fehlgeschlagen"));
                        }
                    });
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        String id = call.getString("id");
        if (id != null) closeClient(id);
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        for (String id : clients.keySet()) closeClient(id);
        super.handleOnDestroy();
    }
}
