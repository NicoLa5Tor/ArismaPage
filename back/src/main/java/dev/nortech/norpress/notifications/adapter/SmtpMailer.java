package dev.nortech.norpress.notifications.adapter;
import dev.nortech.norpress.notifications.application.NotificationPorts.Mailer;
import dev.nortech.norpress.notifications.application.NotificationPorts.Smtp;
import dev.nortech.norpress.notifications.domain.Message;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.mail.Authenticator;
import jakarta.mail.MessagingException;
import jakarta.mail.PasswordAuthentication;
import jakarta.mail.Session;
import jakarta.mail.Transport;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeBodyPart;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.internet.MimeMultipart;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Properties;

/** Sends through any SMTP server (Brevo, Google Workspace, Amazon SES…) with Angus Mail: text and HTML versions together. */
@ApplicationScoped
public class SmtpMailer implements Mailer {
    public void send(Message message, Smtp server, java.util.List<dev.nortech.norpress.notifications.application.NotificationPorts.File> files) {
        var props = new Properties();
        props.put("mail.smtp.host", server.host());
        props.put("mail.smtp.port", String.valueOf(server.port()));
        props.put("mail.smtp.connectiontimeout", "10000");
        props.put("mail.smtp.timeout", "15000");
        props.put("mail.smtp.writetimeout", "15000");
        boolean auth = server.username() != null && !server.username().isBlank();
        props.put("mail.smtp.auth", String.valueOf(auth));
        switch (server.security()) {
            case "SSL" -> { props.put("mail.smtp.ssl.enable", "true"); props.put("mail.smtp.ssl.checkserveridentity", "true"); }
            case "STARTTLS" -> { props.put("mail.smtp.starttls.enable", "true"); props.put("mail.smtp.starttls.required", "true"); props.put("mail.smtp.ssl.checkserveridentity", "true"); }
            default -> { }
        }
        Session session = auth ? Session.getInstance(props, new Authenticator() {
            @Override protected PasswordAuthentication getPasswordAuthentication() { return new PasswordAuthentication(server.username(), server.password() == null ? "" : server.password()); }
        }) : Session.getInstance(props);
        try {
            var mime = new MimeMessage(session);
            mime.setFrom(new InternetAddress(server.fromAddress(), server.fromName(), StandardCharsets.UTF_8.name()));
            mime.setRecipient(jakarta.mail.Message.RecipientType.TO, new InternetAddress(message.to()));
            mime.setSubject(message.subject(), StandardCharsets.UTF_8.name());
            mime.setSentDate(new Date());
            var text = new MimeBodyPart(); text.setText(message.text(), StandardCharsets.UTF_8.name());
            var html = new MimeBodyPart(); html.setContent(message.html(), "text/html; charset=UTF-8");
            var body = new MimeMultipart("alternative", text, html);
            if (files.isEmpty()) mime.setContent(body);
            else {
                // the text and HTML versions first, then each file as an attachment
                var wrapper = new MimeBodyPart(); wrapper.setContent(body);
                var mixed = new MimeMultipart("mixed", wrapper);
                for (var file : files) {
                    var part = new MimeBodyPart();
                    part.setDataHandler(new jakarta.activation.DataHandler(new jakarta.mail.util.ByteArrayDataSource(file.bytes(), file.contentType())));
                    part.setFileName(jakarta.mail.internet.MimeUtility.encodeText(file.name(), StandardCharsets.UTF_8.name(), null));
                    part.setDisposition(jakarta.mail.Part.ATTACHMENT);
                    mixed.addBodyPart(part);
                }
                mime.setContent(mixed);
            }
            Transport.send(mime);
        } catch (MessagingException | java.io.UnsupportedEncodingException e) {
            throw new IllegalStateException(e.getMessage() == null ? "No se pudo enviar el correo" : e.getMessage(), e);
        }
    }
}
