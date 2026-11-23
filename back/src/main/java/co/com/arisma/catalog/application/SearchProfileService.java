package co.com.arisma.catalog.application;
import co.com.arisma.catalog.domain.SearchProfile;
import co.com.arisma.shared.domain.NotFound;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.util.UUID;

/** Keywords and age ranges that make categories and products easier to find. The rules live in SearchProfile. */
@ApplicationScoped
public class SearchProfileService {
    @Inject SearchProfileRepository profiles;

    public SearchProfile ofCategory(UUID id) { return profiles.ofCategory(id).orElseThrow(() -> new NotFound("Categoría no encontrada")); }
    public SearchProfileRepository.ProductProfile ofProduct(UUID id) { return profiles.ofProduct(id).orElseThrow(() -> new NotFound("Producto no encontrado")); }

    @Transactional
    public SearchProfile saveForCategory(UUID id, SearchProfile profile) {
        if (!profiles.replaceForCategory(id, require(profile))) throw new NotFound("Categoría no encontrada");
        return profile;
    }
    @Transactional
    public SearchProfileRepository.ProductProfile saveForProduct(UUID id, SearchProfile profile) {
        if (!profiles.replaceForProduct(id, require(profile))) throw new NotFound("Producto no encontrado");
        return profiles.ofProduct(id).orElseThrow();
    }
    private static SearchProfile require(SearchProfile profile) { if (profile == null) throw new IllegalArgumentException("Datos de búsqueda requeridos"); return profile; }
}
