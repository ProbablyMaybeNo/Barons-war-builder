param(
  [int]$Port = 4173
)

python -m http.server $Port
