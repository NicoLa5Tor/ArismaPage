package co.com.arisma.catalog.application;
import co.com.arisma.catalog.domain.PageSections;
import co.com.arisma.catalog.domain.ProductPage;
import co.com.arisma.shared.domain.NotFound;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.util.List;
import java.util.UUID;

/** What a product's public page says and shows. The description is cleaned before it is checked and stored. */
@ApplicationScoped
public class ProductPageService {
    @Inject ProductPageRepository pages;
    @Inject HtmlCleaner html;

    /** The description is returned cleaned, so the editor never loads markup the store would not show. */
    public ProductPage of(UUID productId) {
        var page = pages.find(productId).orElseThrow(() -> new NotFound("Producto no encontrado"));
        return new ProductPage(page.shortDescription(), html.clean(page.descriptionHtml()), page.highlights(), page.specs(), page.sections());
    }

    @Transactional
    public ProductPage save(UUID productId, String shortDescription, String descriptionHtml, List<String> highlights, List<ProductPage.Spec> specs, PageSections sections) {
        var page = new ProductPage(shortDescription, html.clean(descriptionHtml), highlights, specs, sections);
        if (!pages.replace(productId, page)) throw new NotFound("Producto no encontrado");
        return page;
    }
}
