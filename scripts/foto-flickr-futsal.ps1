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

# Nomi chiari per le cartelle degli album (richiesta di Alex del 20/11):
# «Futsal - Giornata 01», «Calcio a 11 - Giornata 03», «Calcio a 11 - Coppa Titano - Ottavi, ritorno».
# L'id dell'album resta nelle schede .json. Va rilanciato dopo ogni scaricamento:
# le foto nuove di un album gia' rinominato vengono spostate nella cartella col nome chiaro.
$alb = Join-Path (Get-Location) 'flickr\FSGC _ official\Albums'
Get-ChildItem $alb -Directory | ForEach-Object {
  $n = $_.Name; $nuovo = $null
  if ($n -match 'Recupero') { return }
  if ($n -match 'futsal.*?(\d+)\. giornata') { $nuovo = 'Futsal - Giornata {0:D2}' -f [int]$Matches[1] }
  elseif ($n -match 'Campionato Sammarinese.*?(\d+)\. giornata') { $nuovo = 'Calcio a 11 - Giornata {0:D2}' -f [int]$Matches[1] }
  elseif ($n -match 'Coppa Titano.*_ (.+)$') { $nuovo = 'Calcio a 11 - Coppa Titano - ' + $Matches[1] }
  if ($nuovo -and $nuovo -ne $n) {
    $dest = Join-Path $alb $nuovo
    if (Test-Path $dest) { Get-ChildItem $_.FullName | Move-Item -Destination $dest -Force; Remove-Item $_.FullName -Recurse }
    else { Rename-Item $_.FullName $nuovo }
    "$n  ->  $nuovo"
  }
}
