# Kiadástervező – GitHub Pages + Supabase

A weboldal a GitHub Pages-en futó statikus felületből és egy Supabase-adatbázisból áll. Az Excelben szereplő 12 hónap, számlanevek és összegek nyilvános webes fájlokba kerülnek. A pipák és az egyéni plusz kiadások Supabase-be szinkronizálódnak; a Row Level Security csak a bejelentkezett felhasználó saját soraihoz enged hozzáférést.

## 1. Supabase-projekt létrehozása

1. Hozz létre egy projektet a [Supabase](https://supabase.com/dashboard) felületén.
2. A projekt **SQL Editor** oldalán futtasd le a `supabase-schema.sql` teljes tartalmát. Ha korábban már elkészült az adatbázistábla, futtasd le újra a frissített fájlt is: az eltávolítja az ismétlődő Excel-alaptételeket, és Eszti/Norbi, illetve Bíbor/Julcsi külön soraira bontja őket.
3. Az **Authentication → URL Configuration** oldalon add hozzá a Pages webcímet a **Redirect URLs** listához. Projektoldalnál ez például `https://kelanar.github.io/Havi-kiad-s-sszes-t-/`.
4. Az **Authentication → Providers → Email** beállításnál hagyd engedélyezve az e-mailes belépést. A magic link küldéséhez az alapértelmezett levélküldő korlátozott; rendszeres használathoz állíts be saját SMTP-szolgáltatót.
5. A **Project Settings → API** oldalon másold ki a projekt URL-t és a publishable/anon kulcsot. A `service_role` titkos kulcsot soha ne használd a weboldalhoz.

Minden felhasználói rekord az adott bejelentkezett fiókhoz tartozik. Az első belépéskor a checklist adatai automatikusan bekerülnek az adott fiókba. Az alaplista mentése egyedi adatbáziskulccsal történik, hogy egyidejű belépési kérések se hozzanak létre másolatokat. A publikus Excel-adatokból más felhasználók is létrehozhatnak saját, egymástól elkülönített checklistet.

Az eredeti Excelben a két BKK-bérlet összege 18 900 Ft, az Államkincstár-tétel összege 42 230 Ft volt; mindkettőt feleztük a két külön személy között.

## 2. Beállítás a GitHub-repóban

1. A repó **Settings → Secrets and variables → Actions** oldalán hozz létre két repository secretet:
   - `SUPABASE_URL`: a Supabase-projekt URL-je
   - `SUPABASE_ANON_KEY`: a projekt publikus publishable/anon kulcsa
2. A repó **Settings → Pages → Build and deployment** részén állítsd a source-ot **GitHub Actions** értékre.
3. Pusholj a `main` branchre. A `Deploy static app to GitHub Pages` workflow Supabase-konfiguráció nélkül is közzéteszi az oldalt; ilyenkor az adatkapcsolat-beállítási tájékoztató látható, és a belépés le van tiltva.
4. A publikált URL a repó **Settings → Pages** oldalán jelenik meg. Add hozzá a két repository secretet, majd a Supabase Authentication URL-beállításában pontosan ezt a címet is add meg. Ezután pusholj egy módosítást, vagy indítsd el újra kézzel a workflow-t.

A böngészőben használt Supabase publishable/anon kulcs nyilvánosan látható; ez rendben van, mert az adatokat a Supabase adatbázis-szabályai védik. A `service_role` kulcsot, jelszót vagy SMTP hitelesítő adatot ne tegyél GitHub-fájlba vagy Pages secretbe.

## Helyi előnézet

Másold a `supabase-config.example.js` fájlt `supabase-config.js` néven, és írd bele a saját projekt URL-jét és publikus anon/publishable kulcsát. Ez a fájl ki van zárva a Gitből.

Egyszerű helyi HTTP-szerverrel például:

```powershell
python -m http.server 8000
```

Ezután nyisd meg a `http://localhost:8000` címet. A Supabase Redirect URLs listájában helyi próbához add hozzá a `http://localhost:8000/**` címet is.

## A korábbi Streamlit változat

A GitHub Pages statikus tárhely, ezért a Streamlit/Python szerver nem fut rajta. Az `app.py` és a korábbi Python adatkezelő helyi prototípus marad; a publikált változat az `index.html`, `styles.css` és `app.js` fájlokat használja.
