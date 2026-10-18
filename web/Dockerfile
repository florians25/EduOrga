# UntPlanWeb – Container-Image. Build-Kontext ist das Wurzelverzeichnis des UntPlan-Repositorys,
# weil UntPlanWeb die gemeinsame Vertragsbibliothek src/UntPlan.Web.Contracts verwendet:
#   docker build -f web/Dockerfile -t untplanweb .

# 1) Oberfläche (React + MUI, web/client) mit Vite bauen; die Ausgabe landet in web/src/UntPlanWeb/wwwroot
FROM --platform=$BUILDPLATFORM node:22-bookworm-slim AS oberflaeche
WORKDIR /quelle/web/client
COPY web/client/package.json web/client/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/client/ ./
COPY web/src/UntPlanWeb/wwwroot/ /quelle/web/src/UntPlanWeb/wwwroot/
RUN npm run build

# 2) Server bauen – immer auf der Architektur des Build-Rechners; das Ergebnis ist plattformunabhängig (amd64 und arm64)
FROM --platform=$BUILDPLATFORM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /quelle
COPY Directory.Build.props ./
COPY src/UntPlan.Web.Contracts/ src/UntPlan.Web.Contracts/
COPY web/src/UntPlanWeb/UntPlanWeb.csproj web/src/UntPlanWeb/
RUN dotnet restore web/src/UntPlanWeb/UntPlanWeb.csproj
COPY web/src/UntPlanWeb/ web/src/UntPlanWeb/
COPY --from=oberflaeche /quelle/web/src/UntPlanWeb/wwwroot/ web/src/UntPlanWeb/wwwroot/
COPY web/demo/ web/demo/
ARG VERSION=1.0.0
RUN dotnet publish web/src/UntPlanWeb/UntPlanWeb.csproj -c Release -o /app --no-restore -p:UseAppHost=false -p:Version=$VERSION

FROM mcr.microsoft.com/dotnet/aspnet:8.0
LABEL org.opencontainers.image.title="UntPlanWeb" \
      org.opencontainers.image.description="Stundenplan, Vertretungsplan und Rückmeldungen online – Webbegleiter zu UntPlan" \
      org.opencontainers.image.source="https://github.com/florians25/UntPlanNext"
ENV ASPNETCORE_HTTP_PORTS=8080 \
    UNTPLANWEB_DATEN=/data \
    TZ=Europe/Berlin \
    DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false
WORKDIR /app
COPY --from=build /app ./
RUN mkdir -p /data && chown app:app /data
USER app
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD ["dotnet", "UntPlanWeb.dll", "--gesundheitspruefung"]
ENTRYPOINT ["dotnet", "UntPlanWeb.dll"]
