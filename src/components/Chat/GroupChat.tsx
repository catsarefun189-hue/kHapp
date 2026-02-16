import React from 'react';

interface GroupChatProps {
  userPermissions: string[];
}

const GroupChat: React.FC<GroupChatProps> = ({ userPermissions }) => {
  const isAdmin = userPermissions.includes('admin');
  const isOwner = userPermissions.includes('owner');

  return (
    <div>
      <h1>Group Chat</h1>
      {isAdmin && <p>You have admin permissions.</p>}
      {isOwner && <p>You are the owner of this chat.</p>}
      {/* Chat interface goes here */}
    </div>
  );
};

export default GroupChat;