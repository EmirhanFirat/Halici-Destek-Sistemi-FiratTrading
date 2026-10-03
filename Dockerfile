FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /source
COPY src/Halici.Web/Halici.Web.csproj src/Halici.Web/packages.lock.json src/Halici.Web/
RUN dotnet restore src/Halici.Web/Halici.Web.csproj --locked-mode
COPY src/ src/
RUN dotnet publish src/Halici.Web/Halici.Web.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app .
RUN mkdir -p /data && chown -R app:app /data
USER app
ENV ASPNETCORE_HTTP_PORTS=8080 DataDirectory=/data
EXPOSE 8080
ENTRYPOINT ["dotnet", "Halici.Web.dll"]
