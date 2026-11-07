# IHL Manager

Hokejska manager igra lige IHL (po vzoru FM/FHM). Next.js + TypeScript, igra teče v brskalniku, kariera se shrani lokalno.

## Faza 1–2 (ta verzija)
- 9 klubov IHL s pravimi dvoranami in kapacitetami
- Simulacija tekme po korakih po 5 s (napadi, pari, buliji, streli, golman, kazni, PP/PK, podaljšek 3 na 3, kazenski streli, prazna mreža)
- Tekma v živo s prenosom in taktiko med tekmo, hitra simulacija
- Razpored (32 tekem), lestvica, končnica (top 6), statistika, več sezon z razvojem igralcev
- Postave, posebne enote, forček, tempo, minutaža napadov
- Igralci so zaenkrat generirani (AI), prava baza pride v fazi 3

## Razvoj
```
npm install
npm run dev       # http://localhost:3000
npm run simtest   # simulira sezono in izpiše realnost (goli, streli, % obramb)
```

Motor igre je v `src/engine` (brez odvisnosti od vmesnika), zasloni v `src/app`.
