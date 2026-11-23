package co.com.arisma.catalog.application;

/**
 * Keeps only harmless formatting in rich text (paragraphs, lists, emphasis, subheadings, links): no scripts, styles,
 * event handlers, images or embeds. Applied when the panel saves a description and again when the store shows one,
 * because descriptions imported from the old site were never cleaned.
 */
public interface HtmlCleaner {
    String clean(String html);
}
