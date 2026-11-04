param(
    [string]$Src,
    [string]$Dest,
    [int]$Width = 64,
    [int]$Height = 64,
    [switch]$RemoveBg
)

Add-Type -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Collections.Generic;

public class SpriteProcessor {
    public static void Process(string src, string dest, int targetW, int targetH, bool removeBg) {
        using (Bitmap orig = new Bitmap(src)) {
            int w = orig.Width;
            int h = orig.Height;
            Bitmap working = new Bitmap(w, h, PixelFormat.Format32bppArgb);

            BitmapData srcData = orig.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
            BitmapData dstData = working.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);

            int stride = srcData.Stride;
            int byteCount = stride * h;
            byte[] pixels = new byte[byteCount];
            System.Runtime.InteropServices.Marshal.Copy(srcData.Scan0, pixels, 0, byteCount);
            orig.UnlockBits(srcData);

            int minX = w, maxX = 0, minY = h, maxY = 0;

            if (removeBg) {
                // Sample background color from corners
                int bgB = pixels[0];
                int bgG = pixels[1];
                int bgR = pixels[2];

                bool[] visited = new bool[w * h];
                Queue<int> q = new Queue<int>();

                Func<int, bool> isBg = (idx) => {
                    int b = pixels[idx * 4];
                    int g = pixels[idx * 4 + 1];
                    int r = pixels[idx * 4 + 2];
                    int dr = r - bgR;
                    int dg = g - bgG;
                    int db = b - bgB;
                    // Euclidean color distance squared
                    return (dr * dr + dg * dg + db * db) < 3200; // ~56 color distance threshold
                };

                // Seed borders
                for (int x = 0; x < w; x++) {
                    if (isBg(x)) { visited[x] = true; q.Enqueue(x); }
                    int bot = (h - 1) * w + x;
                    if (isBg(bot) && !visited[bot]) { visited[bot] = true; q.Enqueue(bot); }
                }
                for (int y = 0; y < h; y++) {
                    int left = y * w;
                    if (isBg(left) && !visited[left]) { visited[left] = true; q.Enqueue(left); }
                    int right = y * w + (w - 1);
                    if (isBg(right) && !visited[right]) { visited[right] = true; q.Enqueue(right); }
                }

                // BFS Flood Fill
                int[] dx = { 0, 0, 1, -1 };
                int[] dy = { 1, -1, 0, 0 };
                while (q.Count > 0) {
                    int curr = q.Dequeue();
                    int cx = curr % w;
                    int cy = curr / w;

                    for (int i = 0; i < 4; i++) {
                        int nx = cx + dx[i];
                        int ny = cy + dy[i];
                        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                            int nidx = ny * w + nx;
                            if (!visited[nidx]) {
                                visited[nidx] = true;
                                if (isBg(nidx)) {
                                    q.Enqueue(nidx);
                                }
                            }
                        }
                    }
                }

                // Apply alpha & calculate bounding box
                for (int y = 0; y < h; y++) {
                    for (int x = 0; x < w; x++) {
                        int idx = y * w + x;
                        if (visited[idx] && isBg(idx)) {
                            pixels[idx * 4 + 3] = 0; // Transparent
                        } else {
                            if (x < minX) minX = x;
                            if (x > maxX) maxX = x;
                            if (y < minY) minY = y;
                            if (y > maxY) maxY = y;
                        }
                    }
                }
            } else {
                minX = 0; maxX = w - 1; minY = 0; maxY = h - 1;
            }

            System.Runtime.InteropServices.Marshal.Copy(pixels, 0, dstData.Scan0, byteCount);
            working.UnlockBits(dstData);

            // Bounding box cropping
            int cropW = Math.Max(1, maxX - minX + 1);
            int cropH = Math.Max(1, maxY - minY + 1);
            Rectangle cropRect = new Rectangle(minX, minY, cropW, cropH);

            using (Bitmap scaled = new Bitmap(targetW, targetH, PixelFormat.Format32bppArgb)) {
                using (Graphics g = Graphics.FromImage(scaled)) {
                    g.InterpolationMode = InterpolationMode.NearestNeighbor;
                    g.PixelOffsetMode = PixelOffsetMode.Half;
                    g.Clear(Color.Transparent);

                    // Maintain aspect ratio, center in target rectangle
                    float scale = Math.Min((float)(targetW - 4) / cropW, (float)(targetH - 4) / cropH);
                    int drawW = (int)(cropW * scale);
                    int drawH = (int)(cropH * scale);
                    int drawX = (targetW - drawW) / 2;
                    int drawY = targetH - drawH - 2; // Pin feet to bottom

                    g.DrawImage(working, new Rectangle(drawX, drawY, drawW, drawH), cropRect, GraphicsUnit.Pixel);
                }
                string dir = System.IO.Path.GetDirectoryName(dest);
                if (!System.IO.Directory.Exists(dir)) System.IO.Directory.CreateDirectory(dir);
                scaled.Save(dest, ImageFormat.Png);
            }

            working.Dispose();
        }
    }
}
"@ -ReferencedAssemblies System.Drawing

[SpriteProcessor]::Process($Src, $Dest, $Width, $Height, $RemoveBg.IsPresent)
Write-Output "Processed: $Dest"
