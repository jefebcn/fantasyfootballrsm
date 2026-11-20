# Foto del futsal dagli album Flickr della FSGC, come per il calcio a 11:
# una foto + una scheda .json (partita e «©FSGC/Fotografo» in "description").
# Da lanciare sul computer di Alex DENTRO la cartella «FOTO FSGC» di Google Drive:
#   cd "<percorso>\FOTO FSGC"
#   powershell -ExecutionPolicy Bypass -File <repo>\scripts\foto-flickr-futsal.ps1
# Crea flickr\FSGC _ official\Albums\<id> <titolo>\flickr_<id>.jpg (+ .json).
# L'archivio scarica solo le foto nuove: si puo' rilanciare dopo ogni giornata.
# Quando la FSGC pubblica un album nuovo, aggiungi qui il suo indirizzo.
$album = @(
  'https://www.flickr.com/photos/153298317@N08/albums/72177720335620020', # 1ª giornata
  'https://www.flickr.com/photos/153298317@N08/albums/72177720335739307', # 2ª giornata
  'https://www.flickr.com/photos/153298317@N08/albums/72177720336976284', # 9ª giornata
  'https://www.flickr.com/photos/153298317@N08/albums/72177720336956788'  # 10ª giornata
)
python -m pip install -q -U gallery-dl
python -m gallery_dl --write-metadata -o size-max=1024 --download-archive flickr-futsal.sqlite -d . @album
