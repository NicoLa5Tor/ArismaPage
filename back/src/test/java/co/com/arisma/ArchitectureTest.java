package co.com.arisma;
import static org.junit.jupiter.api.Assertions.*;
import java.io.IOException;
import java.nio.file.*;
import java.util.*;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

/**
 * Hexagonal rules, checked on the sources:
 * domain depends on nothing but the JDK; application depends on domain and ports, never on HTTP, SQL or adapters;
 * a module reaches another module only through its application API (or the shared kernel).
 */
class ArchitectureTest {
    private static final Path ROOT = Path.of("src/main/java/co/com/arisma");
    private static final Pattern IMPORT = Pattern.compile("^import\\s+(?:static\\s+)?([\\w.]+)", Pattern.MULTILINE);
    private static final List<String> DOMAIN_FORBIDDEN = List.of("jakarta.", "javax.", "java.sql", "org.postgresql", "com.fasterxml", "io.quarkus", "software.amazon");
    private static final List<String> APPLICATION_FORBIDDEN = List.of("jakarta.ws", "java.sql", "javax.sql", "org.postgresql", "io.quarkus", "software.amazon");

    record Source(String module, String layer, Path file, List<String> imports) {}

    private static List<Source> sources() throws IOException {
        try (var files = Files.walk(ROOT)) {
            return files.filter(f -> f.toString().endsWith(".java")).map(f -> {
                var parts = ROOT.relativize(f).toString().replace('\\', '/').split("/");
                try {
                    var text = Files.readString(f);
                    var imports = IMPORT.matcher(text).results().map(m -> m.group(1)).toList();
                    return new Source(parts[0], parts.length > 2 ? parts[1] : "", f, imports);
                } catch (IOException e) { throw new RuntimeException(e); }
            }).toList();
        }
    }

    @Test void domainIsPure() throws IOException {
        var violations = new ArrayList<String>();
        for (var s : sources()) if (s.layer().equals("domain"))
            for (var i : s.imports()) if (DOMAIN_FORBIDDEN.stream().anyMatch(i::startsWith) || i.contains(".adapter.") || i.contains(".application.")) violations.add(s.file() + " -> " + i);
        assertTrue(violations.isEmpty(), "El dominio solo puede depender del JDK:\n" + String.join("\n", violations));
    }
    /** A module's domain knows only itself and the shared kernel; modules meet in their application layer. */
    @Test void domainDependsOnlyOnItselfAndShared() throws IOException {
        var violations = new ArrayList<String>();
        for (var s : sources()) if (s.layer().equals("domain"))
            for (var i : s.imports()) {
                if (!i.startsWith("co.com.arisma.")) continue;
                String module = i.substring("co.com.arisma.".length()).split("\\.")[0];
                if (!module.equals(s.module()) && !module.equals("shared")) violations.add(s.file() + " -> " + i);
            }
        assertTrue(violations.isEmpty(), "El dominio de un módulo solo depende de sí mismo y de shared:\n" + String.join("\n", violations));
    }
    @Test void applicationHasNoInfrastructure() throws IOException {
        var violations = new ArrayList<String>();
        for (var s : sources()) if (s.layer().equals("application"))
            for (var i : s.imports()) if (APPLICATION_FORBIDDEN.stream().anyMatch(i::startsWith) || i.contains(".adapter.")) violations.add(s.file() + " -> " + i);
        assertTrue(violations.isEmpty(), "La aplicación no puede depender de HTTP, SQL ni adaptadores:\n" + String.join("\n", violations));
    }
    @Test void modulesTalkThroughApplicationApis() throws IOException {
        var violations = new ArrayList<String>();
        for (var s : sources())
            for (var i : s.imports()) {
                if (!i.startsWith("co.com.arisma.")) continue;
                var parts = i.substring("co.com.arisma.".length()).split("\\.");
                String module = parts[0], layer = parts.length > 1 ? parts[1] : "";
                if (module.equals(s.module()) || module.equals("shared")) continue;
                // Another module's domain types may travel through its application API; its adapters never.
                if (layer.equals("adapter")) violations.add(s.file() + " -> " + i);
            }
        assertTrue(violations.isEmpty(), "Un módulo no puede usar los adaptadores de otro:\n" + String.join("\n", violations));
    }
    /** Every write under /api/admin states which permission it needs; @Requires({}) means "any signed-in user". The session endpoint is the only exception. */
    private static final Pattern WRITE = Pattern.compile("(?<![\\w.])@(POST|PUT|DELETE)\\b");
    @Test void everyAdminWriteDeclaresItsPermission() throws IOException {
        var violations = new ArrayList<String>();
        for (var s : sources()) {
            var text = Files.readString(s.file());
            if (!text.contains("@Path(\"/api/admin") || s.file().getFileName().toString().equals("SessionResource.java")) continue;
            boolean classLevel = Pattern.compile("@Requires\\([^)]*\\)\\s*(@\\w+(\\([^)]*\\))?\\s*)*public class").matcher(text).find();
            if (classLevel) continue;
            var lines = text.split("\n");
            for (int i = 0; i < lines.length; i++)
                if (WRITE.matcher(lines[i]).find() && !lines[i].contains("@Requires("))
                    violations.add(s.file() + ":" + (i + 1));
        }
        assertTrue(violations.isEmpty(), "Escrituras sin @Requires:\n" + String.join("\n", violations));
    }
}
