using System;
using System.Text;
using System.Threading.Tasks;
using Windows.Media.Control;

#nullable enable

class Program
{
    static string EscapeJson(string s)
    {
        return s.Replace("\\", "\\\\").Replace("\"", "\\\"")
                .Replace("\n", "\\n").Replace("\r", "\\r").Replace("\t", "\\t");
    }

    static async Task Main(string[] args)
    {
        Console.OutputEncoding = Encoding.UTF8;
        bool debug = args.Length > 0 && args[0] == "--debug";

        GlobalSystemMediaTransportControlsSessionManager? manager;
        try
        {
            manager = await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();
            if (debug) Console.Error.WriteLine("[DEBUG] SMTC manager created OK");
        }
        catch (Exception ex)
        {
            if (debug) Console.Error.WriteLine($"[DEBUG] SMTC manager failed: {ex.Message}");
            while (true)
            {
                Console.WriteLine("null");
                await Task.Delay(3000);
            }
        }

        while (true)
        {
            try
            {
                string? result = null;

                var sessions = manager.GetSessions();
                if (debug) Console.Error.WriteLine($"[DEBUG] Sessions count: {sessions.Count}");

                foreach (var session in sessions)
                {
                    var aumid = session.SourceAppUserModelId ?? "(unknown)";
                    var playback = session.GetPlaybackInfo();
                    var status = playback.PlaybackStatus;

                    if (debug) Console.Error.WriteLine($"[DEBUG]   Session: {aumid} Status: {status}");

                    if (status != GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing)
                        continue;

                    var props = await session.TryGetMediaPropertiesAsync();
                    var title = props.Title ?? "";
                    var artist = props.Artist ?? "";

                    if (debug) Console.Error.WriteLine($"[DEBUG]   Title: \"{title}\" Artist: \"{artist}\"");

                    if (string.IsNullOrEmpty(title))
                        continue;

                    var timeline = session.GetTimelineProperties();
                    double duration = 0;
                    double elapsed = 0;
                    if (timeline != null)
                    {
                        duration = Math.Round((timeline.EndTime - timeline.StartTime).TotalSeconds, 2);
                        elapsed = Math.Round(timeline.Position.TotalSeconds, 2);
                    }

                    // Build JSON manually — JsonSerializer is broken by PublishTrimmed
                    var sb = new StringBuilder();
                    sb.Append("{\"title\":\"").Append(EscapeJson(title)).Append('"');
                    sb.Append(",\"artist\":\"").Append(EscapeJson(artist)).Append('"');
                    sb.Append(",\"duration\":").Append(duration);
                    sb.Append(",\"elapsedTime\":").Append(elapsed);
                    sb.Append(",\"processName\":\"").Append(EscapeJson(aumid)).Append('"');
                    sb.Append('}');
                    result = sb.ToString();
                    break;
                }

                Console.WriteLine(result ?? "null");
            }
            catch (Exception ex)
            {
                if (debug) Console.Error.WriteLine($"[DEBUG] Error: {ex.Message}");
                Console.WriteLine("null");
            }

            await Task.Delay(3000);
        }
    }
}
