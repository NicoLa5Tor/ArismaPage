package dev.nortech.norpress.media.domain;
import java.util.*;

/**
 * Ordered images of one product. The first image is the primary one (cover in lists, first photo in the store),
 * so "make primary", reorder and delete are all just new orders.
 */
public record Gallery(List<UUID> order) {
    public static final int MAX_IMAGES = 30;
    public Gallery { order = List.copyOf(order); }
    public UUID primary() { return order.isEmpty() ? null : order.get(0); }
    public boolean contains(UUID id) { return order.contains(id); }
    public void requireRoom() { if (order.size() >= MAX_IMAGES) throw new IllegalArgumentException("Un producto admite máximo " + MAX_IMAGES + " imágenes"); }
    public Gallery append(UUID id) { requireRoom(); var next = new ArrayList<>(order); next.add(id); return new Gallery(next); }
    public Gallery makePrimary(UUID id) {
        require(id);
        var next = new ArrayList<UUID>(); next.add(id);
        for (UUID other : order) if (!other.equals(id)) next.add(other);
        return new Gallery(next);
    }
    /** The new order must contain exactly the same images, each once. */
    public Gallery reorder(List<UUID> next) {
        if (next == null || next.size() != order.size() || new HashSet<>(next).size() != next.size() || !new HashSet<>(next).equals(new HashSet<>(order)))
            throw new IllegalArgumentException("El nuevo orden debe incluir cada imagen del producto una sola vez");
        return new Gallery(next);
    }
    /** Removing the primary promotes the next image. */
    public Gallery remove(UUID id) {
        require(id);
        var next = new ArrayList<>(order); next.remove(id);
        return new Gallery(next);
    }
    private void require(UUID id) { if (!order.contains(id)) throw new IllegalArgumentException("La imagen no pertenece a este producto"); }
}
