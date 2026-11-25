# NorPress backend (Quarkus, JVM). Configuration comes from the environment at run time: DB_URL, DB_USER, DB_PASSWORD
# and every NORPRESS_* setting (see README.md). Flyway migrates the database on start.
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -B -q dependency:go-offline || true
COPY src src
RUN mvn -B -q package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/quarkus-app/ ./
# application.properties listens on 127.0.0.1 for local work; inside a container it must listen on every interface
ENV QUARKUS_HTTP_HOST=0.0.0.0 PORT=9001
EXPOSE 9001
USER 10001
CMD ["java", "-jar", "quarkus-run.jar"]
