using System;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Windows.Media.Control;

class Program
{
    static async Task Main(string[] args)
    {
        Console.OutputEncoding = Encoding.UTF8;

        GlobalSystemMediaTransportControlsSessionManager? manager;
        try
        {
            manager = await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();
        }
        catch
        {
            // Loop outputting null if manager unavailable
            while (true)
            {
                Console.WriteLine("null");
                await Task.Delay(10000);
            }
            return;
        }

        while (true)
        {
            try
            {
                var session = manager.GetCurrentSession();
                if (session != null)
                {
                    var playback = session.GetPlaybackInfo();
                    if (playback.PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing)
                    {
                        var props = await session.TryGetMediaPropertiesAsync();
                        var timeline = session.GetTimelineProperties();

                        double duration = 0;
                        double elapsed = 0;
                        if (timeline != null)
                        {
                            duration = Math.Round((timeline.EndTime - timeline.StartTime).TotalSeconds, 2);
                            elapsed = Math.Round(timeline.Position.TotalSeconds, 2);
                        }

                        var title = props.Title ?? "";
                        var artist = props.Artist ?? "";
                        var aumid = session.SourceAppUserModelId ?? "";

                        if (!string.IsNullOrEmpty(title))
                        {
                            var json = JsonSerializer.Serialize(new
                            {
                                title,
                                artist,
                                duration,
                                elapsedTime = elapsed,
                                processName = aumid
                            });
                            Console.WriteLine(json);
                        }
                        else
                        {
                            Console.WriteLine("null");
                        }
                    }
                    else
                    {
                        Console.WriteLine("null");
                    }
                }
                else
                {
                    Console.WriteLine("null");
                }
            }
            catch
            {
                Console.WriteLine("null");
            }

            await Task.Delay(10000);
        }
    }
}
