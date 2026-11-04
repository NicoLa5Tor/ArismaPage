package co.com.arisma.shared.adapter;
import java.sql.*;
import java.util.*;

/** Persistence support for adapters: rows become maps with camelCase keys (read models), Instants bind as timestamps. */
public final class Jdbc {
    private static final com.fasterxml.jackson.databind.ObjectMapper JSON = new com.fasterxml.jackson.databind.ObjectMapper();
    private Jdbc() {}
    @FunctionalInterface public interface Work<T> { T run(Connection c) throws SQLException; }
    /** Runs work on a pooled connection (enlisted in the caller's JTA transaction, if any); SQL errors become unchecked. */
    public static <T> T with(javax.sql.DataSource db, Work<T> work) {
        try(var c=db.getConnection()) { return work.run(c); }
        catch(SQLException e) { throw new IllegalStateException("Error de base de datos",e); }
    }
    public static boolean duplicate(Throwable e) { for(var t=e;t!=null;t=t.getCause()) if(t instanceof SQLException s && "23505".equals(s.getSQLState())) return true; return false; }
    public static List<Map<String,Object>> list(Connection c, String sql, Object... params) throws SQLException {
        try(var s=c.prepareStatement(sql)) {
            for(int i=0;i<params.length;i++) s.setObject(i+1,params[i] instanceof java.time.Instant t ? Timestamp.from(t) : params[i]);
            try(var r=s.executeQuery()) {
                var meta=r.getMetaData(); var out=new ArrayList<Map<String,Object>>();
                while(r.next()) { var row=new LinkedHashMap<String,Object>(); for(int i=1;i<=meta.getColumnCount();i++) row.put(camel(meta.getColumnLabel(i)),value(r.getObject(i))); out.add(row); }
                return out;
            }
        }
    }
    public static Optional<Map<String,Object>> one(Connection c, String sql, Object... params) throws SQLException { var rows=list(c,sql,params); return rows.isEmpty()?Optional.empty():Optional.of(rows.get(0)); }
    public static long count(Connection c, String sql, Object... params) throws SQLException { return ((Number)one(c,sql,params).orElseThrow().values().iterator().next()).longValue(); }
    public static int update(Connection c, String sql, Object... params) throws SQLException {
        try(var s=c.prepareStatement(sql)) { for(int i=0;i<params.length;i++) s.setObject(i+1,params[i] instanceof java.time.Instant t ? Timestamp.from(t) : params[i]); return s.executeUpdate(); }
    }
    private static Object value(Object v) throws SQLException {
        if(v instanceof Timestamp t) return t.toInstant();
        if(v instanceof java.sql.Date d) return d.toLocalDate();
        if(v instanceof org.postgresql.util.PGobject p && ("jsonb".equals(p.getType()) || "json".equals(p.getType()))) { try { return JSON.readTree(p.getValue()); } catch(com.fasterxml.jackson.core.JsonProcessingException e) { return null; } }
        if(v instanceof Array a) return Arrays.asList((Object[])a.getArray());
        return v;
    }
    private static String camel(String s) {
        var b=new StringBuilder(); boolean up=false;
        for(char ch:s.toCharArray()) { if(ch=='_') up=true; else { b.append(up?Character.toUpperCase(ch):ch); up=false; } }
        return b.toString();
    }
}
