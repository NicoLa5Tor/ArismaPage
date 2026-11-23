package co.com.arisma.shared.adapter;
import java.lang.annotation.*;

/**
 * Protects a public endpoint that bots like to hammer (sign-in, sign-up, password reset): at most {@code limit} calls per
 * client address in {@code windowSeconds}, counted per {@code bucket}; with {@code human} the call also needs a valid
 * Cloudflare Turnstile token in the X-Turnstile-Token header. Checked by {@link GuardFilter}.
 */
@Retention(RetentionPolicy.RUNTIME) @Target(ElementType.METHOD) @Documented
public @interface Guarded {
    String bucket();
    int limit();
    int windowSeconds();
    boolean human() default false;
}
