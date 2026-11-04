package co.com.arisma.catalog.adapter;
import co.com.arisma.shared.adapter.Requires;
import co.com.arisma.shared.domain.Permission;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;
import javax.sql.DataSource;
import java.util.*;

@Path("/api/admin/categories") @Produces(MediaType.APPLICATION_JSON) @Consumes(MediaType.APPLICATION_JSON)
public class AdminCategoryResource {
    @Inject DataSource db;
    public record Category(UUID id,String name,String slug,String description,UUID parentId) {}
    @GET public List<Category> list() throws Exception {
        try(var c=db.getConnection(); var s=c.prepareStatement("SELECT id,name,slug,description,parent_id FROM category ORDER BY name"); var r=s.executeQuery()) {
            var out=new ArrayList<Category>(); while(r.next()) out.add(new Category((UUID)r.getObject(1),r.getString(2),r.getString(3),r.getString(4),(UUID)r.getObject(5))); return out;
        }
    }
    @Requires(Permission.CATALOG_EDIT) @POST public Response create(Category category) throws Exception { return save(UUID.randomUUID(),category,true); }
    @Requires(Permission.CATALOG_EDIT) @PUT @Path("/{id}") public Response update(@PathParam("id") UUID id,Category category) throws Exception { return save(id,category,false); }
    private Response save(UUID id, Category v, boolean create) throws Exception {
        if(v==null || v.name()==null || v.name().isBlank() || v.slug()==null || v.slug().isBlank() || id.equals(v.parentId())) throw new BadRequestException("Nombre, slug y categoría padre válidos son obligatorios");
        try(var c=db.getConnection()) {
            if(v.parentId()!=null) try(var check=c.prepareStatement("WITH RECURSIVE ancestors AS (SELECT id,parent_id FROM category WHERE id=? UNION SELECT c.id,c.parent_id FROM category c JOIN ancestors a ON c.id=a.parent_id) SELECT 1 FROM ancestors WHERE id=?")) { check.setObject(1,v.parentId()); check.setObject(2,id); try(var r=check.executeQuery()){if(r.next()) throw new BadRequestException("La categoría padre crea un ciclo");} }
            String sql=create?"INSERT INTO category(id,name,slug,description,parent_id) VALUES(?,?,?,?,?)":"UPDATE category SET name=?,slug=?,description=?,parent_id=? WHERE id=?";
            try(var s=c.prepareStatement(sql)) { int i=1;if(create)s.setObject(i++,id);s.setString(i++,v.name().trim());s.setString(i++,v.slug().trim());s.setString(i++,v.description()==null?"":v.description());s.setObject(i++,v.parentId());if(!create)s.setObject(i,id);if(s.executeUpdate()==0) throw new NotFoundException(); }
            return Response.status(create?201:200).entity(new Category(id,v.name(),v.slug(),v.description(),v.parentId())).build();
        }
    }
}
