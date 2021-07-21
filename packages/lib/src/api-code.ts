// TODO complete all the status

// SBH-- shouldn't be here

export enum Code {
    Ok = 0,
    Unknown,
    Whocare,
    // 1000 - 1999 
    // NOTE: something system error, shouldn't post the Msg to customer

    Pro_Err = 1001,


    // 2000 - 2999
    // All the request success but limit
    Auth_Fail = 2001,
    Access_Deny,

    Pro_Num_Limit,
    Pro_Name_Err,
    Pro_Stat_Err,
    Pro_Update_Err,


    Chain_Err,  // SBH

    Rpc_Err,
    Out_Of_Limit,
    Black_UID,
    Dup_Name,

    // db 3000 - 3999
}

export enum Msg {

    Ok = 'ok',
    Unknown = 'unknown error',
    Whocare = 'dont care',

    // Auth
    Auth_Fail = 'Authenticated failed',
    Access_Deny = 'Access not allow',

    // project
    Pro_Err = 'project error',
    Pro_Num_Limit = 'project created number out of limit',
    Pro_Name_Error = 'project name empty or invalid',
    Pro_Stat_Err = 'project status is inactive or unavailable',
    Pro_Update_Err = 'project info update error',

    // chain
    Chain_Err = 'chain error',

    // 
    Rpc_Err = 'RPC error',
    Out_Of_Limit = 'request out of limit',
    Black_UID = 'Black UID',
    Dup_Name = 'Duplicate name'
}