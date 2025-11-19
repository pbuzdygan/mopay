# MOPAY

![MOPAY Banner](mopay_banner.png)

**MOPAY** to samohostowalna aplikacja do zarządzania finansami osobistymi / domowym budżetem.

- ✅ Nowoczesny interfejs (React + Vite + Tailwind)
- ✅ Backend API (Node.js)
- ✅ PWA – działa jak natywna aplikacja, tryb offline
- ✅ Obsługa wielu lat, wpisów, raportów, celów oszczędnościowych
- ✅ Przyjazny dla self-hostingu (Docker, docker-compose, reverse proxy)

---

## Demo / screenshoty

> TODO: wrzuć 1–3 screenshoty do `branding/` i odkomentuj poniżej.

<!--
![Ekran główny](branding/mopay_screen_main.png)
![Widok raportów](branding/mopay_screen_reports.png)
-->

---

## Funkcje

- Zarządzanie **latami rozliczeniowymi**
- Dodawanie, edycja i usuwanie **wpisów przychodów i wydatków**
- **Raporty** i podsumowania
- **Cele oszczędnościowe** i śledzenie postępu
- **PIN guard** (blokada dostępu)
- Tryb **offline** (PWA, cache zasobów)
- Przygotowane pod **reverse proxy** (np. Nginx Proxy Manager)

---

## Uruchomienie – Docker (GHCR)

Najprostszy sposób na start: użyć gotowego obrazu z GitHub Container Registry.

```bash
docker run -d \
  --name mopay \
  -p 3000:3000 \
  ghcr.io/<twoj-user>/<twoje-repo>:latest
