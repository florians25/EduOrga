# EduOrga Website – Container-Image (Produktseiten + Ideenportal). Build-Kontext ist die Wurzel des Repositorys,
# weil die Oberfläche Gestaltung (design/) und Bildschirmfotos (studio/, web/, mobile/docs/bilder) übernimmt:
#   docker build -f website/Dockerfile -t untplannext-website .

# 1) Oberfläche (React + Fluent UI, website/client) mit Vite bauen → website/src/EduOrgaWebsite/wwwroot
FROM --platform=$BUILDPLATFORM node:22-bookworm-slim AS oberflaeche
WORKDIR /quelle/website/client
COPY website/client/package.json website/client/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY design/tokens.css /quelle/design/tokens.css
COPY design/fonts/ /quelle/design/fonts/
COPY design/logo/ /quelle/design/logo/
COPY studio/docs/bilder/ /quelle/studio/docs/bilder/
COPY web/docs/bilder/ /quelle/web/docs/bilder/
COPY mobile/docs/bilder/ /quelle/mobile/docs/bilder/
COPY website/client/ ./
RUN npm run build

# 2) Server bauen (plattformunabhängig, läuft auf amd64 und arm64)
FROM --platform=$BUILDPLATFORM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /quelle
COPY Directory.Build.props ./
COPY website/src/EduOrgaWebsite/EduOrgaWebsite.csproj website/src/EduOrgaWebsite/
RUN dotnet restore website/src/EduOrgaWebsite/EduOrgaWebsite.csproj
COPY website/src/EduOrgaWebsite/ website/src/EduOrgaWebsite/
COPY --from=oberflaeche /quelle/website/src/EduOrgaWebsite/wwwroot/ website/src/EduOrgaWebsite/wwwroot/
ARG VERSION=1.0.0
RUN dotnet publish website/src/EduOrgaWebsite/EduOrgaWebsite.csproj -c Release -o /app --no-restore -p:UseAppHost=false -p:Version=$VERSION -p:WebsiteOberflaecheBauen=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0
LABEL org.opencontainers.image.title="EduOrga Website" \
      org.opencontainers.image.description="Produkt-Website von EduOrga mit Ideen-, Wunsch- und Fehlerportal" \
      org.opencontainers.image.source="https://github.com/florians25/UntPlanNext"
ENV ASPNETCORE_HTTP_PORTS=8080 \
    WEBSITE_DATEN=/data \
    TZ=Europe/Berlin \
    DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false
WORKDIR /app
COPY --from=build /app ./
# Datenordner (website.db, Schlüssel, Sicherungen); läuft als Benutzer „app“ (ohne Root-Rechte)
RUN mkdir -p /data && chown app:app /data
USER app
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD ["dotnet", "EduOrgaWebsite.dll", "--gesundheitspruefung"]
ENTRYPOINT ["dotnet", "EduOrgaWebsite.dll"]
