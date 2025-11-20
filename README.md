# MOPAY

![MOPAY Banner](branding/mopay_banner.png)

<p align="center">
  <img src="branding/mopay_banner.png" alt="MOPAY Banner" width="33%">
</p>


**MOPAY** to samohostowalna aplikacja do zarządzania finansami osobistymi / domowym budżetem.

- ✅ Nowoczesny interfejs (React + Vite + Tailwind)
- ✅ Backend API (Node.js)
- ✅ PWA – działa jak natywna aplikacja, tryb offline
- ✅ Obsługa wielu lat, wpisów, raportów, celów oszczędnościowych
- ✅ Przyjazny dla self-hostingu (Docker, docker-compose, reverse proxy)

---

## Demo / screenshoty

![Ekran główny 1 Dark](branding/0_dark.png)
![Ekran główny 1 Light](branding/0_light.png)
![Ekran główny 2 Dark](branding/1_dark.png)
![Ekran główny 2 Light](branding/1_light.png)
![Oszczędności Dark](branding/2_dark.png)
![Oszczędności Light](branding/2_light.png)
![Raporty Dark](branding/3_dark.png)
![Raporty Light](branding/3_light.png)
![Ustawienia Dark](branding/4_dark.png)
![Ustawienia Light](branding/4_light.png)


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
