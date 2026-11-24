package dev.nortech.norpress.catalog.adapter;
import dev.nortech.norpress.shared.adapter.Requires;
import dev.nortech.norpress.shared.domain.Permission;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;
import javax.sql.DataSource;
import java.util.*;

@Path("/api/admin/products/{productId}/categories") @Produces(MediaType.APPLICATION_JSON) @Consumes(MediaType.APPLICATION_JSON)
public class AdminProductCategoryResource {
    @Inject DataSource db;
    @GET public List<UUID> get(@PathParam("productId") UUID id) throws Exception {
        try(var c=db.getConnection();var q=c.prepareStatement("SELECT category_id FROM product_category WHERE product_id=?")){q.setObject(1,id);try(var r=q.executeQuery()){var result=new ArrayList<UUID>();while(r.next())result.add((UUID)r.getObject(1));return result;}}
    }
    @Requires(Permission.CATALOG_EDIT) @PUT public Response put(@PathParam("productId") UUID id,List<UUID> categories) throws Exception {
        if(categories==null || categories.size()>200 || categories.contains(null) || new HashSet<>(categories).size()!=categories.size()) throw new BadRequestException("Selección de categorías inválida");
        try(var c=db.getConnection()) {c.setAutoCommit(false);try{
            try(var q=c.prepareStatement("SELECT 1 FROM product WHERE id=? FOR UPDATE")){q.setObject(1,id);try(var r=q.executeQuery()){if(!r.next())throw new NotFoundException();}}
            try(var q=c.prepareStatement("DELETE FROM product_category WHERE product_id=?")){q.setObject(1,id);q.executeUpdate();}
            try(var q=c.prepareStatement("INSERT INTO product_category(product_id,category_id) VALUES(?,?)")){for(UUID category:categories){q.setObject(1,id);q.setObject(2,category);q.addBatch();}q.executeBatch();}
            // the search index picks up changed products by updated_at
            try(var q=c.prepareStatement("UPDATE product SET updated_at=now() WHERE id=?")){q.setObject(1,id);q.executeUpdate();}
            c.commit();return Response.noContent().build();
        }catch(Exception e){c.rollback();throw e;}}
    }
}
