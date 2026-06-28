# Sinh icon PWA cho TMH AI BUSINESS — viên kim cương (gem) vàng trên nền navy.
# Khớp nhận diện TopNav: gold #F5C84B trên near-black #0B0C14.
# Xuất: icon-192.png, icon-512.png, apple-touch-icon.png (180), maskable-512.png
Add-Type -AssemblyName System.Drawing

function Pt($dx, $dy, $cx, $s, $size) {
  New-Object System.Drawing.PointF([float]($cx + $dx * $s), [float]($size * $dy))
}

function New-Icon($size, $path, $gemScale) {
  $bmp = New-Object System.Drawing.Bitmap([int]$size, [int]$size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  # Nền gradient navy (đầy khung — OS tự bo góc cho iOS/maskable)
  $rect = New-Object System.Drawing.Rectangle(0, 0, [int]$size, [int]$size)
  $c1 = [System.Drawing.Color]::FromArgb(255, 0x1A, 0x1B, 0x28)
  $c2 = [System.Drawing.Color]::FromArgb(255, 0x0B, 0x0C, 0x14)
  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c2, [float]90)
  $g.FillRectangle($bg, $rect)

  $cx = $size / 2.0
  $s  = $size * $gemScale

  $tl  = Pt (-0.36) (0.30) $cx $s $size
  $tr  = Pt ( 0.36) (0.30) $cx $s $size
  $gr  = Pt ( 0.60) (0.42) $cx $s $size
  $bot = Pt ( 0.00) (0.82) $cx $s $size
  $gl  = Pt (-0.60) (0.42) $cx $s $size
  $tc  = Pt ( 0.00) (0.30) $cx $s $size
  $pts = [System.Drawing.PointF[]]@($tl, $tr, $gr, $bot, $gl)

  $gold      = [System.Drawing.Color]::FromArgb(255, 0xF5, 0xC8, 0x4B)
  $goldLight = [System.Drawing.Color]::FromArgb(255, 0xFF, 0xE0, 0x8A)
  $goldDark  = [System.Drawing.Color]::FromArgb(255, 0xC9, 0xA2, 0x3A)

  $gemRect = New-Object System.Drawing.Rectangle(0, [int]($size * 0.26), [int]$size, [int]($size * 0.60))
  $fill = New-Object System.Drawing.Drawing2D.LinearGradientBrush($gemRect, $goldLight, $goldDark, [float]90)
  $g.FillPolygon($fill, $pts)

  # Đường facet (vàng đậm)
  $pen = New-Object System.Drawing.Pen($goldDark, [float]($size * 0.014))
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $g.DrawLine($pen, $gl, $gr)
  $g.DrawLine($pen, $tl, $gl)
  $g.DrawLine($pen, $tr, $gr)
  $g.DrawLine($pen, $tl, $bot)
  $g.DrawLine($pen, $tr, $bot)
  $g.DrawLine($pen, $gl, $bot)
  $g.DrawLine($pen, $gr, $bot)
  $g.DrawLine($pen, $tc, $bot)

  # Viền ngoài gem
  $outline = New-Object System.Drawing.Pen($gold, [float]($size * 0.016))
  $outline.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $g.DrawPolygon($outline, $pts)

  $g.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "  wrote $path ($size px)"
}

$pub = Join-Path $PSScriptRoot "..\public"
New-Icon 512 (Join-Path $pub "icon-512.png")         0.52
New-Icon 192 (Join-Path $pub "icon-192.png")         0.52
New-Icon 180 (Join-Path $pub "apple-touch-icon.png") 0.52
New-Icon 512 (Join-Path $pub "maskable-512.png")     0.42
Write-Host "done."
