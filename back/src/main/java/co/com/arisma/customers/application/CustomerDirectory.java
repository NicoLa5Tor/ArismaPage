package co.com.arisma.customers.application;
import java.util.UUID;

/** Finds or creates the customer behind a purchase, so orders from the store land on the same customer as before. */
public interface CustomerDirectory {
    /** The customer with that email, created when missing. Contact details given at checkout fill the gaps of an existing one, never overwrite. */
    UUID ensure(String email, String firstName, String lastName, String phone, String documentType, String documentNumber, String company);
}
