# MOPAY

![MOPAY Banner](branding/mopay_banner.png)

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
![Ekran główny]
(branding/0_dark.png)(branding/0_light.png)
(branding/1_dark.png)(branding/1_light.png)

![Oszczędności]
(branding/2_dark.png)(branding/2_light.png)

![Raporty]
(branding/3_dark.png)(branding/3_light.png)

![Ustawienia]
(branding/4_dark.png)(branding/4_light.png)
-->

---

## Funkcje

- Zarządzanie **latami rozliczeniowymi**
- Dodawanie, edycja i usuwanie **wpisów przychodów i wydatków**
- **Raporty** i podsumowania
- **Cele oszczędnościowe** i śledzenie postępu
- **PIN guard** (blokada dostępu)
- Tryb **offline** (PWA, cache zasobów)

---

## Uruchomienie – Docker (GHCR)

Najprostszy sposób na start: użyć gotowego obrazu z GitHub Container Registry.

```bash
docker run -d \
  --name mopay \
  -p 8010:8010 \
  ghcr.io/<twoj-user>/<twoje-repo>:latest
