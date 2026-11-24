package dev.nortech.norpress.shared.adapter;
import dev.nortech.norpress.shared.domain.Permission;
import java.lang.annotation.*;

/** Permissions an admin endpoint needs; checked by the identity module's request filter. ArchitectureTest makes it mandatory on every write. */
@Retention(RetentionPolicy.RUNTIME) @Target({ElementType.METHOD, ElementType.TYPE}) @Documented
public @interface Requires {
    Permission[] value();
}
