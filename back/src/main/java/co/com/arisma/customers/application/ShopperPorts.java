package co.com.arisma.customers.application;
import co.com.arisma.identity.domain.LoginGuard;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/** Ports of store accounts, grouped because each is small. */
public final class ShopperPorts {
    private ShopperPorts() {}

    /** The signed-in shopper, as every other module sees them. emailVerified: an identity provider vouched for the address. */
    public record Shopper(UUID accountId, UUID customerId, String name, String email, boolean emailVerified) {}
    public record StoredShopper(Shopper shopper, String passwordHash, LoginGuard guard) {}

    public interface ShopperRepository {
        Optional<StoredShopper> findByEmail(String email);
        Optional<StoredShopper> find(UUID accountId);
        /** Creates the account and, when no customer has that email yet, the customer too. Conflict when the email already has an account. */
        Shopper create(String name, String email, String passwordHash, boolean emailVerified);
        /** An identity provider vouched for the address: whoever had set a password on it may not be its owner, so the password and sessions go. */
        void markVerifiedByProvider(UUID accountId);
        /** The owner proved the address by opening a link sent to it: the account keeps its password. */
        void confirmEmail(UUID accountId);
        void rename(UUID accountId, String name);
        void setPassword(UUID accountId, String passwordHash);
        void saveGuard(UUID accountId, LoginGuard guard);
        void recordLogin(UUID accountId, Instant at);
        void createSession(String tokenHash, UUID accountId, Instant expiresAt);
        Optional<UUID> sessionAccount(String tokenHash, Instant now);
        void deleteSession(String tokenHash);
        /** Signs the account out everywhere, except the session given (null: everywhere). */
        void deleteSessions(UUID accountId, String keepTokenHash);
    }

    /** A customer's saved addresses. Every call is scoped to the customer: an id of another customer is simply not found. */
    public interface AddressBook {
        java.util.List<co.com.arisma.customers.domain.Address> list(UUID customerId);
        Optional<co.com.arisma.customers.domain.Address> find(UUID customerId, UUID addressId);
        int count(UUID customerId);
        /** Inserts (id null) or updates; when `asDefault`, the others stop being the default. Answers the stored address. */
        co.com.arisma.customers.domain.Address save(UUID customerId, co.com.arisma.customers.domain.Address address, boolean asDefault);
        /** False when it was not there. If it was the default, the most recent remaining one takes its place. */
        boolean delete(UUID customerId, UUID addressId);
        boolean makeDefault(UUID customerId, UUID addressId);
    }
    /** The buyer's own data on their customer record (name, phone, document). */
    public interface Profiles {
        co.com.arisma.customers.domain.Profile get(UUID customerId);
        void save(UUID customerId, co.com.arisma.customers.domain.Profile profile);
    }
    /** Colombia's official municipalities (DANE), by department. */
    public interface Places {
        java.util.List<String> cities(String state, int limit);
        /** The official name of that municipality in that department, ignoring case and accents; empty when it is not one. */
        Optional<String> municipality(String state, String name);
    }

    /** One-time links sent by email. */
    public enum TokenPurpose { VERIFY, RESET }
    public interface TokenRepository {
        void issue(String tokenHash, UUID accountId, TokenPurpose purpose, Instant expiresAt);
        /** Marks the token used and answers its account, only when it exists, has that purpose, is unused and has not expired. */
        Optional<UUID> consume(String tokenHash, TokenPurpose purpose, Instant now);
        /** How many of that kind were issued for the account since then (to stop a mailbox being flooded). */
        long issuedSince(UUID accountId, TokenPurpose purpose, Instant since);
    }
}
