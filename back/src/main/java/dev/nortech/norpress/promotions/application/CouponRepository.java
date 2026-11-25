package dev.nortech.norpress.promotions.application;
import dev.nortech.norpress.promotions.domain.Coupon;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Coupon persistence. Read models include real usage counted over paid orders. */
public interface CouponRepository {
    List<Map<String, Object>> list();
    Optional<Map<String, Object>> find(UUID id);
    /** The coupon with that code, ignoring case. */
    Optional<Coupon> findByCode(String code);
    /** Locks the coupon with this code until the transaction ends (nothing when there is none). */
    void lock(String code);
    /** Orders holding the coupon that were not cancelled, failed or refunded; only those of `email` when it is given. */
    long usesHeld(UUID couponId, String email);
    void insert(Coupon coupon);
    /** Returns false when the coupon does not exist. */
    boolean update(Coupon coupon);
}
