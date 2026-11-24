package dev.nortech.norpress.shared.domain;

/** What a panel user may change. Reading is open to every signed-in user; each write declares the permission it needs. */
public enum Permission {
    CATALOG_EDIT, TAXES_MANAGE, COUPONS_MANAGE, USERS_MANAGE, ORDERS_MANAGE, QUOTES_MANAGE, FULFILLMENT_MANAGE, SETTINGS_MANAGE, REVIEWS_MANAGE
}
