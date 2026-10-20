# UntPlan Studio – Container-Image. Build-Kontext ist das Wurzelverzeichnis des UntPlan-Repositorys,
# weil das Studio die gemeinsame Fachlogik src/UntPlan.Core (und src/UntPlan.Web.Contracts) verwendet:
#   docker build -f studio/Dockerfile -t untplanstudio .

# 1) Oberfläche (React + Fluent UI, studio/client) mit Vite bauen; die Ausgabe landet in studio/src/UntPlanStudio/wwwroot.
#    Die Gestaltungsgrundlagen (design/tokens.css, Logo) liegen außerhalb von studio/client und werden mitkopiert.
FROM --platform=$BUILDPLATFORM node:22-bookworm-slim AS oberflaeche
WORKDIR /quelle/studio/client
COPY studio/client/package.json studio/client/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY design/tokens.css /quelle/design/tokens.css
COPY design/logo/ /quelle/design/logo/
COPY studio/client/ ./
RUN npm run build

# 2) Server bauen – immer auf der Architektur des Build-Rechners; das Ergebnis ist plattformunabhängig (amd64 und arm64)
FROM --platform=$BUILDPLATFORM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /quelle
COPY Directory.Build.props ./
COPY src/UntPlan.Web.Contracts/UntPlan.Web.Contracts.csproj src/UntPlan.Web.Contracts/
COPY src/UntPlan.Core/UntPlan.Core.csproj src/UntPlan.Core/
COPY src/UntPlan.Druck/UntPlan.Druck.csproj src/UntPlan.Druck/
COPY studio/src/UntPlanStudio/UntPlanStudio.csproj studio/src/UntPlanStudio/
RUN dotnet restore studio/src/UntPlanStudio/UntPlanStudio.csproj
COPY src/UntPlan.Web.Contracts/ src/UntPlan.Web.Contracts/
COPY src/UntPlan.Core/ src/UntPlan.Core/
COPY src/UntPlan.Druck/ src/UntPlan.Druck/
COPY studio/src/UntPlanStudio/ studio/src/UntPlanStudio/
# gemeinsame Update-Prüfung mit UntPlan Web und Mobile (in UntPlanStudio.csproj eingebunden)
COPY web/src/UntPlanWeb/Dienste/Updatepruefung.cs web/src/UntPlanWeb/Dienste/
COPY --from=oberflaeche /quelle/studio/src/UntPlanStudio/wwwroot/ studio/src/UntPlanStudio/wwwroot/
ARG VERSION=1.0.0
RUN dotnet publish studio/src/UntPlanStudio/UntPlanStudio.csproj -c Release -o /app --no-restore -p:UseAppHost=false -p:Version=$VERSION -p:StudioOberflaecheBauen=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0
LABEL org.opencontainers.image.title="UntPlan Studio" \
      org.opencontainers.image.description="Stunden- und Vertretungsplanung für Schulen im Browser" \
      org.opencontainers.image.source="https://github.com/florians25/EduOrga"
ENV ASPNETCORE_HTTP_PORTS=8080 \
    STUDIO_DATEN=/data \
    TZ=Europe/Berlin \
    DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false
WORKDIR /app
COPY --from=build /app ./
# Datenordner für Schuldateien, Benutzer und Schlüssel; läuft als Benutzer „app“ (ohne Root-Rechte)
RUN mkdir -p /data && chown app:app /data
USER app
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD ["dotnet", "UntPlanStudio.dll", "--gesundheitspruefung"]
ENTRYPOINT ["dotnet", "UntPlanStudio.dll"]
