import type { TripRepository } from '@/domain/trip/repositories/TripRepository';
import { httpClient } from '@/infrastructure/http/httpClient';
import type { Trip, TripEnvelope, TripInput, TripSummary } from '@shared/types/trip';

export class HttpTripRepository implements TripRepository {
  list(): Promise<TripSummary[]> {
    return httpClient.get<TripSummary[]>('/trips');
  }

  getById(id: string): Promise<TripEnvelope> {
    return httpClient.get<TripEnvelope>(`/trips/${id}`);
  }

  create(input?: TripInput): Promise<Trip> {
    return httpClient.post<Trip>('/trips', input);
  }

  update(id: string, input: TripInput): Promise<Trip> {
    return httpClient.put<Trip>(`/trips/${id}`, input);
  }

  remove(id: string): Promise<void> {
    return httpClient.delete<void>(`/trips/${id}`);
  }

  setPublic(id: string, isPublic: boolean): Promise<Trip> {
    return httpClient.patch<Trip>(`/trips/${id}/settings`, { isPublic });
  }
}

/** Instance partagée du repository. */
export const tripRepository: TripRepository = new HttpTripRepository();
