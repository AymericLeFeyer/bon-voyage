import type { MembershipRepository } from '@/domain/membership/repositories/MembershipRepository';
import { httpClient } from '@/infrastructure/http/httpClient';
import type { Invitation, InviteInfo, InviteResponse, TripMembers } from '@shared/types/user';

export class HttpMembershipRepository implements MembershipRepository {
  getMembers(tripId: string): Promise<TripMembers> {
    return httpClient.get<TripMembers>(`/trips/${tripId}/members`);
  }

  invite(tripId: string, email: string): Promise<InviteResponse> {
    return httpClient.post<InviteResponse>(`/trips/${tripId}/invite`, { email });
  }

  cancelInvite(tripId: string, email: string): Promise<void> {
    return httpClient.delete<void>(`/trips/${tripId}/invites`, { email });
  }

  removeMember(tripId: string, userId: string): Promise<void> {
    return httpClient.delete<void>(`/trips/${tripId}/members/${userId}`);
  }

  listInvitations(): Promise<Invitation[]> {
    return httpClient.get<Invitation[]>('/me/invitations');
  }

  acceptInvitation(tripId: string): Promise<void> {
    return httpClient.post<void>(`/me/invitations/${tripId}/accept`);
  }

  declineInvitation(tripId: string): Promise<void> {
    return httpClient.post<void>(`/me/invitations/${tripId}/decline`);
  }

  getInvite(token: string): Promise<InviteInfo> {
    return httpClient.get<InviteInfo>(`/invites/${token}`);
  }

  acceptInvite(token: string): Promise<{ tripId: string }> {
    return httpClient.post<{ tripId: string }>(`/invites/${token}/accept`);
  }

  declineInvite(token: string): Promise<void> {
    return httpClient.post<void>(`/invites/${token}/decline`);
  }
}

export const membershipRepository: MembershipRepository = new HttpMembershipRepository();
