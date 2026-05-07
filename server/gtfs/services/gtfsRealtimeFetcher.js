import fetch from 'node-fetch';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

const MTA_FEEDS = [
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs',         // 1 2 3 4 5 6 7 S
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace',     // A C E
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw',    // N Q R W
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm',    // B D F M
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-g',       // G
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-jz',      // J Z
];

export async function fetchLiveFeeds() {
  const results = await Promise.all(MTA_FEEDS.map(async (url) => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return [];
      const buffer = await res.arrayBuffer();
      const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
        new Uint8Array(buffer)
      );
      return feed.entity || [];
    } catch (err) {
      console.warn('Failed to fetch feed ' + url + ': ' + err.message);
      return [];
    }
  }));
  
  return results.flat();
}
