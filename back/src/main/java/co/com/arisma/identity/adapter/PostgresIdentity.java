package co.com.arisma.identity.adapter;
import co.com.arisma.identity.application.IdentityPorts.*;
import co.com.arisma.identity.domain.AdminAccount;
import co.com.arisma.identity.domain.LoginGuard;
import co.com.arisma.identity.domain.Role;
import co.com.arisma.shared.adapter.Jdbc;
import co.com.arisma.shared.domain.Conflict;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import javax.sql.DataSource;
import java.time.Instant;
import java.util.*;

@ApplicationScoped
public class PostgresIdentity implements UserRepository, SessionRepository {
    private static final String USER = "SELECT id,email,name,role,active,password_hash,must_change_password,failed_attempts,locked_until FROM admin_user";
    private static final String VIEW = "SELECT u.id,u.email,u.name,u.role,u.active,u.must_change_password,u.last_login_at,u.locked_until>now() AS locked,u.created_at,c.name AS created_by_name,"
        + "(SELECT count(*) FROM admin_session s WHERE s.user_id=u.id AND s.expires_at>now()) AS open_sessions FROM admin_user u LEFT JOIN admin_user c ON c.id=u.created_by";
    @Inject DataSource db;

    private static StoredUser stored(Map<String,Object> r) {
        var account = new AdminAccount((UUID)r.get("id"),(String)r.get("email"),(String)r.get("name"),Role.parse((String)r.get("role")),(Boolean)r.get("active"));
        return new StoredUser(account,(String)r.get("passwordHash"),(Boolean)r.get("mustChangePassword"),new LoginGuard(((Number)r.get("failedAttempts")).intValue(),(Instant)r.get("lockedUntil")));
    }
    public Optional<StoredUser> findByEmail(String email) { return Jdbc.with(db,c -> Jdbc.one(c,USER+" WHERE email=lower(?)",email).map(PostgresIdentity::stored)); }
    public Optional<StoredUser> find(UUID id) { return Jdbc.with(db,c -> Jdbc.one(c,USER+" WHERE id=?",id).map(PostgresIdentity::stored)); }
    public Optional<StoredUser> lock(UUID id) { return Jdbc.with(db,c -> Jdbc.one(c,USER+" WHERE id=? FOR UPDATE",id).map(PostgresIdentity::stored)); }
    public List<Map<String,Object>> list() { return Jdbc.with(db,c -> Jdbc.list(c,VIEW+" ORDER BY u.active DESC,u.role,lower(u.name)")); }
    public Optional<Map<String,Object>> view(UUID id) { return Jdbc.with(db,c -> Jdbc.one(c,VIEW+" WHERE u.id=?",id)); }
    /** Locks every active administrator so two simultaneous demotions cannot both pass the "last admin" rule. */
    public long activeAdmins() { return Jdbc.with(db,c -> Jdbc.count(c,"SELECT count(*) FROM (SELECT id FROM admin_user WHERE role='admin' AND active FOR UPDATE) a")); }
    public void insert(AdminAccount a, String hash, UUID createdBy) {
        try { Jdbc.with(db,c -> Jdbc.update(c,"INSERT INTO admin_user(id,email,name,role,active,password_hash,must_change_password,created_by) VALUES(?,?,?,?,?,?,true,?)",a.id(),a.email(),a.name(),a.role().db(),a.active(),hash,createdBy)); }
        catch(IllegalStateException e) { if(Jdbc.duplicate(e)) throw new Conflict("Ya existe un usuario con ese correo"); throw e; }
    }
    public void update(AdminAccount a) { Jdbc.with(db,c -> Jdbc.update(c,"UPDATE admin_user SET name=?,role=?,active=?,updated_at=now() WHERE id=?",a.name(),a.role().db(),a.active(),a.id())); }
    public void setPassword(UUID id, String hash, boolean mustChange) { Jdbc.with(db,c -> Jdbc.update(c,"UPDATE admin_user SET password_hash=?,must_change_password=?,updated_at=now() WHERE id=?",hash,mustChange,id)); }
    public void saveGuard(UUID id, LoginGuard g) { Jdbc.with(db,c -> Jdbc.update(c,"UPDATE admin_user SET failed_attempts=?,locked_until=? WHERE id=?",g.failedAttempts(),g.lockedUntil(),id)); }
    public void recordLogin(UUID id, Instant at) { Jdbc.with(db,c -> Jdbc.update(c,"UPDATE admin_user SET last_login_at=? WHERE id=?",at,id)); }

    public void create(String tokenHash, UUID userId, String csrfHash, Instant expiresAt) { Jdbc.with(db,c -> Jdbc.update(c,"INSERT INTO admin_session(token_hash,user_id,csrf_hash,expires_at) VALUES(?,?,?,?)",tokenHash,userId,csrfHash,expiresAt)); }
    public Optional<SessionRecord> find(String tokenHash, Instant now) {
        return Jdbc.with(db,c -> Jdbc.one(c,"SELECT user_id,csrf_hash,expires_at FROM admin_session WHERE token_hash=? AND expires_at>?",tokenHash,now).map(r -> new SessionRecord((UUID)r.get("userId"),(String)r.get("csrfHash"),(Instant)r.get("expiresAt"))));
    }
    public void rotateCsrf(String tokenHash, String csrfHash) { Jdbc.with(db,c -> Jdbc.update(c,"UPDATE admin_session SET csrf_hash=? WHERE token_hash=?",csrfHash,tokenHash)); }
    public void delete(String tokenHash) { Jdbc.with(db,c -> Jdbc.update(c,"DELETE FROM admin_session WHERE token_hash=?",tokenHash)); }
    public void deleteForUser(UUID userId) { Jdbc.with(db,c -> Jdbc.update(c,"DELETE FROM admin_session WHERE user_id=?",userId)); }
    public void deleteForUserExcept(UUID userId, String keep) { Jdbc.with(db,c -> Jdbc.update(c,"DELETE FROM admin_session WHERE user_id=? AND token_hash<>?",userId,keep)); }
}
